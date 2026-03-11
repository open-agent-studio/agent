/**
 * LLM types — request/response shapes for provider abstraction
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
    toolCalls?: LLMToolCall[];
}

export interface LLMToolDefinition {
    name: string;
    description: string;
    inputSchema: unknown; // JSON Schema or Zod
}

export interface LLMRequest {
    messages: LLMMessage[];
    tools?: LLMToolDefinition[];
    maxTokens?: number;
    temperature?: number;
    skillName?: string; // For provider routing overrides
}

export interface LLMToolCall {
    id: string;
    name: string;
    args: unknown;
}

export interface LLMResponse {
    content: string;
    toolCalls?: LLMToolCall[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    provider: string;
    model: string;
}

export interface LLMProvider {
    name: string;
    chat(request: LLMRequest): Promise<LLMResponse>;
    generateEmbedding?(text: string): Promise<number[]>;
    isAvailable(): Promise<boolean>;
}
