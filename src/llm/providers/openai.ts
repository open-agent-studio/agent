import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from '../types.js';
import type { ModelProvider } from '../../config/schema.js';

/**
 * OpenAI provider adapter
 */
export class OpenAIProvider implements LLMProvider {
    name = 'openai';
    private config: ModelProvider;

    constructor(config: ModelProvider) {
        this.config = config;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({
            apiKey: this.config.apiKey ?? process.env['OPENAI_API_KEY'],
            baseURL: this.config.baseUrl,
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

        const response = await client.chat.completions.create({
            model: this.config.model,
            messages,
            tools: tools && tools.length > 0 ? tools : undefined,
            max_tokens: request.maxTokens ?? this.config.maxTokens,
            temperature: request.temperature ?? this.config.temperature,
        });

        const choice = response.choices[0];
        const toolCalls: LLMToolCall[] = [];

        if (choice.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                toolCalls.push({
                    id: tc.id,
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments),
                });
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
            provider: 'openai',
            model: this.config.model,
        };
    }

    async isAvailable(): Promise<boolean> {
        const key = this.config.apiKey ?? process.env['OPENAI_API_KEY'];
        return !!key;
    }
}
