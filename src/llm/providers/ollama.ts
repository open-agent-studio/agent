import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from '../types.js';
import type { ModelProvider } from '../../config/schema.js';

/**
 * Ollama provider adapter (local model support)
 */
export class OllamaProvider implements LLMProvider {
    name = 'ollama';
    private config: ModelProvider;

    constructor(config: ModelProvider) {
        this.config = config;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        const baseUrl = this.config.baseUrl ?? 'http://localhost:11434';

        const messages = request.messages.map((m) => {
            const msg: Record<string, unknown> = {
                role: m.role,
                content: m.content,
            };
            if (m.toolCalls && m.toolCalls.length > 0) {
                msg.tool_calls = m.toolCalls.map(tc => ({
                    function: {
                        name: tc.name,
                        arguments: tc.args
                    }
                }));
            }
            return msg;
        });

        const body: Record<string, unknown> = {
            model: this.config.model,
            messages,
            stream: false,
            options: {
                temperature: request.temperature ?? this.config.temperature,
                num_predict: request.maxTokens ?? this.config.maxTokens,
            },
        };

        // Ollama tool support (if available)
        if (request.tools && request.tools.length > 0) {
            body['tools'] = request.tools.map((t) => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema,
                },
            }));
        }

        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as OllamaResponse;

        const toolCalls: LLMToolCall[] = [];
        if (data.message?.tool_calls) {
            for (const tc of data.message.tool_calls) {
                toolCalls.push({
                    id: `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    name: tc.function.name,
                    args: tc.function.arguments,
                });
            }
        }

        return {
            content: data.message?.content ?? '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: data.eval_count
                ? {
                    promptTokens: data.prompt_eval_count ?? 0,
                    completionTokens: data.eval_count,
                    totalTokens: (data.prompt_eval_count ?? 0) + data.eval_count,
                }
                : undefined,
            provider: 'ollama',
            model: this.config.model,
        };
    }

    async isAvailable(): Promise<boolean> {
        const baseUrl = this.config.baseUrl ?? 'http://localhost:11434';
        try {
            const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
            return response.ok;
        } catch {
            return false;
        }
    }
}

interface OllamaResponse {
    message?: {
        role: string;
        content: string;
        tool_calls?: {
            function: {
                name: string;
                arguments: unknown;
            };
        }[];
    };
    eval_count?: number;
    prompt_eval_count?: number;
}
