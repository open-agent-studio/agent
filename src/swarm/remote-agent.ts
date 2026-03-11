import { randomUUID } from 'node:crypto';
import type { AgentRole, AgentTask, SwarmAgent } from './types.js';

/**
 * RemoteAgentBridge
 * 
 * Allows the orchestrator to assign tasks to an agent running on a different machine.
 * It connects to the remote Agent Studio instance via POST /api/execute and SSE streaming.
 */
export class RemoteAgentBridge {
    private url: string;
    private key?: string;
    public agentInfo: SwarmAgent;

    constructor(url: string, role: AgentRole, name: string, key?: string) {
        this.url = url;
        this.key = key;
        this.agentInfo = {
            id: `remote-${role}-${randomUUID().slice(0, 8)}`,
            role,
            name: `${name} (Remote)`,
            status: 'idle',
            model: 'remote-model',
            depth: 0,
            completedTasks: 0,
        };
    }

    /**
     * Executes a task on the remote agent and returns the result.
     */
    async executeTask(task: AgentTask, onProgress?: (msg: string) => void): Promise<string> {
        this.agentInfo.status = 'busy';
        this.agentInfo.currentTask = task.id;

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.key) {
                headers['Authorization'] = `Bearer ${this.key}`;
            }

            // If the role matches a specific skill name, we could pass it. 
            // For now, we just pass the goal.
            const response = await fetch(`${this.url.replace(/\/$/, '')}/api/execute`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ goal: task.description })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({})) as any;
                throw new Error(err.error || `HTTP ${response.status} ${response.statusText}`);
            }

            if (!response.body) throw new Error('No response body from remote server');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalOutput = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let newlineIndex;

                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);

                    if (line.startsWith('data: ')) {
                        const dataString = line.slice(6);
                        if (dataString === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataString);
                            if (data.type === 'progress' && onProgress) {
                                onProgress(data.message);
                            } else if (data.type === 'result') {
                                finalOutput = data.output;
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            // ignore parse errors
                        }
                    }
                }
            }

            this.agentInfo.status = 'idle';
            this.agentInfo.currentTask = undefined;
            this.agentInfo.completedTasks++;
            return finalOutput;

        } catch (err) {
            this.agentInfo.status = 'error';
            this.agentInfo.currentTask = undefined;
            throw err;
        }
    }
}
