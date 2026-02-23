import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from '../types.js';
import type { ModelProvider } from '../../config/schema.js';

/**
 * Azure OpenAI provider adapter
 * Uses the OpenAI SDK with Azure-specific configuration (deployment, API version, base URL)
 */
export class AzureOpenAIProvider implements LLMProvider {
    name = 'azure';
    private config: ModelProvider;

    constructor(config: ModelProvider) {
        this.config = config;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        const openaiModule = await import('openai');
        const AzureOpenAI = openaiModule.AzureOpenAI;

        const apiKey = this.config.apiKey || process.env['AZURE_API_KEY'] || process.env['AZURE_OPENAI_API_KEY'];
        // Remove trailing slashes from endpoint as the SDK expects a base URL
        let endpoint = this.config.baseUrl || process.env['AZURE_API_BASE'] || process.env['AZURE_OPENAI_ENDPOINT'] || '';
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);

        const apiVersion = this.config.apiVersion || process.env['AZURE_API_VERSION'] || process.env['AZURE_OPENAI_API_VERSION'] || '2024-02-15-preview';
        const deploymentName = this.config.deploymentName || process.env['AZURE_DEPLOYMENT_NAME'] || this.config.model;

        const client = new AzureOpenAI({
            apiKey,
            endpoint,
            apiVersion,
            deployment: deploymentName,
        });

        const tools = request.tools?.map((t) => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema as Record<string, unknown>,
            },
        }));

        const messages = request.messages.map((m) => {
            if (m.role === 'tool') {
                return {
                    role: 'tool' as const,
                    content: m.content,
                    tool_call_id: m.toolCallId ?? '',
                };
            }

            const msg: any = {
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content,
            };

            if (m.toolCalls && m.toolCalls.length > 0) {
                msg.tool_calls = m.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                    },
                }));
            }

            return msg;
        });

        const createParams: Record<string, unknown> = {
            model: deploymentName,
            messages,
            tools: tools && tools.length > 0 ? tools : undefined,
            max_completion_tokens: request.maxTokens ?? this.config.maxTokens,
        };

        // Only include temperature if explicitly set in the request (some models reject non-default values)
        if (request.temperature !== undefined) {
            createParams.temperature = request.temperature;
        }

        const response = await client.chat.completions.create(createParams as unknown as Parameters<typeof client.chat.completions.create>[0]) as unknown as {
            choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        const choice = response.choices[0];
        const toolCalls: LLMToolCall[] = [];

        if (choice.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                const callInfo: LLMToolCall = {
                    id: tc.id,
                    name: tc.function.name,
                    args: {},
                };

                try {
                    callInfo.args = JSON.parse(tc.function.arguments || '{}');
                } catch (err) {
                    console.error(`Failed to parse tool arguments for ${tc.function.name}: ${(err as Error).message}`);
                }

                toolCalls.push(callInfo);
            }
        }

        return {
            content: choice.message.content ?? '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                }
                : undefined,
            provider: 'azure',
            model: deploymentName,
        };
    }

    async isAvailable(): Promise<boolean> {
        const key = this.config.apiKey || process.env['AZURE_API_KEY'] || process.env['AZURE_OPENAI_API_KEY'];
        const base = this.config.baseUrl || process.env['AZURE_API_BASE'] || process.env['AZURE_OPENAI_ENDPOINT'];
        return !!(key && base);
    }
}
