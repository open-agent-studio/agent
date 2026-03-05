// ─── Inter-Agent Message Bus ───
// Event-driven pub/sub for swarm agent communication.

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { SwarmMessage, SwarmMessageType } from './types.js';

export class MessageBus extends EventEmitter {
    private messages: SwarmMessage[] = [];
    private subscriptions: Map<string, Set<string>> = new Map(); // agentId -> Set of types

    /**
     * Send a message from one agent to another (or broadcast).
     */
    send(from: string, to: string, type: SwarmMessageType, payload: unknown): SwarmMessage {
        const message: SwarmMessage = {
            id: randomUUID(),
            from,
            to,
            type,
            payload,
            timestamp: new Date(),
        };

        this.messages.push(message);

        // Emit to specific agent
        if (to === 'broadcast') {
            this.emit('broadcast', message);
        } else {
            this.emit(`agent:${to}`, message);
        }

        // Emit globally for monitoring
        this.emit('message', message);

        return message;
    }

    /**
     * Subscribe an agent to receive messages.
     */
    subscribe(agentId: string, callback: (msg: SwarmMessage) => void): void {
        this.on(`agent:${agentId}`, callback);
        this.on('broadcast', (msg: SwarmMessage) => {
            // Don't echo broadcasts back to sender
            if (msg.from !== agentId) callback(msg);
        });
    }

    /**
     * Get message history for an agent.
     */
    getHistory(agentId: string): SwarmMessage[] {
        return this.messages.filter(m => m.from === agentId || m.to === agentId || m.to === 'broadcast');
    }

    /**
     * Get all messages.
     */
    getAllMessages(): SwarmMessage[] {
        return [...this.messages];
    }

    /**
     * Clear all messages and listeners.
     */
    reset(): void {
        this.messages = [];
        this.subscriptions.clear();
        this.removeAllListeners();
    }
}
