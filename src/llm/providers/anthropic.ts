import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from '../types.js';
import type { ModelProvider } from '../../config/schema.js';

/**
 * Anthropic provider adapter
 */
export class AnthropicProvider implements LLMProvider {
    name = 'anthropic';
    private config: ModelProvider;

    constructor(config: ModelProvider) {
        this.config = config;
    }

    async chat(request: LLMRequest): Promise<LLMResponse> {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({
            apiKey: this.config.apiKey ?? process.env['ANTHROPIC_API_KEY'],
        });

        // Separate system message
        const systemMessage = request.messages.find((m) => m.role === 'system')?.content ?? '';
        const messages = request.messages
            .filter((m) => m.role !== 'system')
            .map((m): any => {
                if (m.role === 'tool') {
                    return {
                        role: 'user' as const,
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: m.toolCallId ?? '',
                                content: m.content
                            }
                        ]
                    };
                }

                if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
                    const content: any[] = [];
                    if (m.content) {
                        content.push({ type: 'text', text: m.content });
                    }
                    for (const tc of m.toolCalls) {
                        content.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.name,
                            input: tc.args
                        });
                    }
                    return {
                        role: 'assistant' as const,
                        content
                    };
                }

                return {
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                };
            });

        const tools = request.tools?.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: { type: 'object' as const, ...(t.inputSchema as Record<string, unknown>) },
        }));

        const response = await client.messages.create({
            model: this.config.model,
            system: systemMessage,
            messages,
            tools: tools && tools.length > 0 ? tools : undefined,
            max_tokens: request.maxTokens ?? this.config.maxTokens,
            temperature: request.temperature ?? this.config.temperature,
        });

        let content = '';
        const toolCalls: LLMToolCall[] = [];

        for (const block of response.content) {
            if (block.type === 'text') {
                content += block.text;
            } else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    args: block.input,
                });
            }
        }

        return {
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
            provider: 'anthropic',
            model: this.config.model,
        };
    }

    async isAvailable(): Promise<boolean> {
        const key = this.config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
        return !!key;
    }
}
