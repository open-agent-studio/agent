import type { LLMMessage } from '../llm/types.js';
import type { SessionStore } from '../session/session-store.js';
import { randomUUID } from 'node:crypto';

/**
 * Conversation State Manager — maintains multi-turn context within a REPL session
 * Now backed by persistent SQLite storage
 */
export class ConversationManager {
    public sessionId: string;
    public sessionName: string | null;

    private messages: LLMMessage[] = [];
    private systemPrompt: string;
    private turnCount = 0;
    private store?: SessionStore;

    constructor(systemPrompt: string, store?: SessionStore, id?: string, name?: string | null) {
        this.systemPrompt = systemPrompt;
        this.store = store;
        this.sessionId = id || randomUUID();
        this.sessionName = name || null;
        this.messages.push({ role: 'system', content: systemPrompt });
    }

    /**
     * Restore an existing session from the store
     */
    static load(store: SessionStore, sessionId: string): ConversationManager | null {
        const data = store.load(sessionId);
        if (!data) return null;

        const manager = new ConversationManager(data.systemPrompt, store, data.id, data.name);
        manager.messages = data.messages;
        manager.turnCount = data.turnCount;
        return manager;
    }

    private autoSave(): void {
        if (!this.store) return;
        this.store.save({
            id: this.sessionId,
            name: this.sessionName,
            messages: this.messages,
            systemPrompt: this.systemPrompt,
            turnCount: this.turnCount,
            status: 'active'
        });
    }

    /**
     * Add a user message
     */
    addUser(content: string): void {
        this.messages.push({ role: 'user', content });
        this.turnCount++;
        this.autoSave();
    }

    /**
     * Add an assistant message
     */
    addAssistant(content: string, toolCalls?: LLMMessage['toolCalls']): void {
        this.messages.push({ role: 'assistant', content, toolCalls });
        this.autoSave();
    }

    /**
     * Add a tool result
     */
    addToolResult(content: string, toolCallId: string): void {
        this.messages.push({ role: 'tool', content, toolCallId });
        this.autoSave();
    }

    /**
     * Get all messages for the LLM
     */
    getMessages(): LLMMessage[] {
        return [...this.messages];
    }

    /**
     * Current turn count
     */
    get turns(): number {
        return this.turnCount;
    }

    /**
     * Compact the conversation — keep system prompt + last N turns
     */
    compact(keepTurns = 4): void {
        const system = this.messages[0];
        const recent: LLMMessage[] = [];
        let turnsSeen = 0;

        // Walk backwards to collect recent turns
        for (let i = this.messages.length - 1; i >= 1; i--) {
            const msg = this.messages[i];
            if (msg.role === 'user') turnsSeen++;
            recent.unshift(msg);
            if (turnsSeen >= keepTurns) break;
        }

        this.messages = [system, ...recent];
        this.autoSave();
    }

    /**
     * Reset conversation
     */
    reset(): void {
        this.messages = [{ role: 'system', content: this.systemPrompt }];
        this.turnCount = 0;
        this.autoSave();
    }
}
