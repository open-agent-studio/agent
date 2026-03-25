import type { LLMProvider, LLMRequest, LLMResponse } from './types.js';
import type { AgentConfig } from '../config/schema.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OllamaProvider } from './providers/ollama.js';
import { AzureOpenAIProvider } from './providers/azure.js';

/**
 * LLM Router — selects and routes requests to the appropriate provider
 * with configurable offline-first, online fallback, and per-skill overrides
 */
export class LLMRouter {
    private providers: Map<string, LLMProvider> = new Map();
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
        this.initProviders();
    }

// Removed static sanitize methods to use dynamic ones in executeWithProvider

    private async executeWithProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
        const nameMap = new Map<string, string>();
        const sanitize = (name: string) => {
            const sanitized = name.replace(/\./g, '_');
            nameMap.set(sanitized, name);
            return sanitized;
        };
        const unsanitize = (name: string) => nameMap.get(name) || name;

        // Many LLMs (like OpenAI) strictly reject dots in tool names via API HTTP validation
        const sanitizedRequest: LLMRequest = {
            ...request,
            tools: request.tools?.map(t => ({
                ...t,
                name: sanitize(t.name)
            })),
            messages: request.messages.map(m => {
                const newM = { ...m };
                if (newM.name) {
                    newM.name = sanitize(newM.name);
                }
                if (newM.toolCalls) {
                    newM.toolCalls = newM.toolCalls.map(tc => ({
                        ...tc,
                        name: sanitize(tc.name)
                    }));
                }
                return newM;
            })
        };

        const response = await provider.chat(sanitizedRequest);

        // Convert the underscore names back to their original dot notation natively using the request map
        if (response.toolCalls) {
            response.toolCalls = response.toolCalls.map(tc => ({
                ...tc,
                name: unsanitize(tc.name)
            }));
        }

        return response;
    }

    /**
     * Send a chat request to the best available provider
     */
    async chat(request: LLMRequest): Promise<LLMResponse> {
        // Check for skill-specific provider override
        if (request.skillName) {
            const override = this.config.models.routing.skillOverrides[request.skillName];
            if (override) {
                const provider = this.providers.get(override);
                if (provider && await provider.isAvailable()) {
                    return this.executeWithProvider(provider, request);
                }
            }
        }

        // Determine provider order based on routing config
        const defaultProvider = this.config.models.routing.defaultProvider;
        const baseChain = this.config.models.routing.fallbackChain.filter(p => p !== defaultProvider);
        const chain = this.config.models.routing.offlineFirst
            ? this.getOfflineFirstChain()
            : [defaultProvider, ...baseChain];

        // Try providers in order
        const maxRetries = this.config.tools.maxRetries || 2;
        let lastError: Error | undefined;

        for (const providerName of chain) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
                try {
                    if (await provider.isAvailable()) {
                        return await this.executeWithProvider(provider, request);
                    } else {
                        break; // Skip to next provider if totally unavailable (e.g., missing API key)
                    }
                } catch (err) {
                    lastError = err as Error;
                    const errString = lastError.message.toLowerCase();

                    // Identify if retry makes sense (Rate Limit, Timeout, 5xx)
                    const isRetryable = errString.includes('rate') ||
                        errString.includes('429') ||
                        errString.includes('50') ||
                        errString.includes('limit') ||
                        errString.includes('timeout') ||
                        errString.includes('ECONNRESET');

                    if (isRetryable && attempt <= maxRetries) {
                        const backoffMs = attempt * 2000;
                        console.warn(`[LLM] ${providerName} rate limited/failed. Retrying in ${backoffMs / 1000}s... (Attempt ${attempt}/${maxRetries})`);
                        await new Promise((r) => setTimeout(r, backoffMs));
                        continue;
                    }

                    // Log error and try next provider if not retryable or out of retries
                    console.error(`[LLM] Provider ${providerName} failed: ${lastError.message}`);
                    break;
                }
            }
        }

        throw new Error(
            `No LLM provider available or all failed.\nLast Error: ${lastError?.message || 'Unknown'}\nTried: ${chain.join(', ')}`
        );
    }

    /**
     * Simple text generation without tools — convenience wrapper
     */
    async generateText(prompt: string, options: { temperature?: number } = {}): Promise<string> {
        const response = await this.chat({
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature
        });
        return response.content;
    }

    /**
     * Check which providers are available
     */
    async getAvailableProviders(): Promise<string[]> {
        const available: string[] = [];
        for (const [name, provider] of this.providers) {
            if (await provider.isAvailable()) {
                available.push(name);
            }
        }
        return available;
    }

    /**
     * Get a specific provider
     */
    getProvider(name: string): LLMProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Generate an embedding vector for a given text string.
     * Routes to the first available provider that supports embeddings.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const defaultProvider = this.config.models.routing.defaultProvider;
        const baseChain = this.config.models.routing.fallbackChain.filter(p => p !== defaultProvider);
        const chain = this.config.models.routing.offlineFirst
            ? this.getOfflineFirstChain()
            : [defaultProvider, ...baseChain];

        for (const providerName of chain) {
            const provider = this.providers.get(providerName);
            if (provider && provider.generateEmbedding && await provider.isAvailable()) {
                try {
                    return await provider.generateEmbedding(text);
                } catch (err) {
                    console.warn(`[LLM] Provider ${providerName} failed to generate embedding: ${(err as Error).message}`);
                    // Continue to next provider on failure
                }
            }
        }

        throw new Error(`No LLM provider available that supports embeddings.\nTried: ${chain.join(', ')}`);
    }

    // ─── Private ───

    private initProviders(): void {
        for (const [name, providerConfig] of Object.entries(this.config.models.providers)) {
            switch (providerConfig.type) {
                case 'openai':
                    this.providers.set(name, new OpenAIProvider(providerConfig));
                    break;
                case 'anthropic':
                    this.providers.set(name, new AnthropicProvider(providerConfig));
                    break;
                case 'ollama':
                    this.providers.set(name, new OllamaProvider(providerConfig));
                    break;
                case 'azure':
                    this.providers.set(name, new AzureOpenAIProvider(providerConfig));
                    break;
            }
        }
    }

    private getOfflineFirstChain(): string[] {
        // Put local providers first
        const local: string[] = [];
        const online: string[] = [];

        for (const [name, config] of Object.entries(this.config.models.providers)) {
            if (config.type === 'ollama') {
                local.push(name);
            } else {
                online.push(name);
            }
        }

        return [...local, ...online];
    }
}
