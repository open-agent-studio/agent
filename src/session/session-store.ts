import type { Database } from 'better-sqlite3';
import { MemoryStore } from '../memory/store.js';
import type { LLMMessage } from '../llm/types.js';

export interface SessionData {
    id: string;
    name: string | null;
    messages: LLMMessage[];
    systemPrompt: string;
    turnCount: number;
    status: 'active' | 'archived';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * SessionStore — Manages persistence of agent conversations
 * Backed by the same SQLite database as MemoryStore
 */
export class SessionStore {
    private db: Database;

    constructor(workDir: string) {
        // We ensure migrations have run by initializing MemoryStore first
        const memStore = MemoryStore.open(workDir);
        this.db = (memStore as any).db as Database;
    }

    /**
     * Save or update a session
     */
    save(session: Omit<SessionData, 'createdAt' | 'updatedAt'>): void {
        const stmt = this.db.prepare(`
            INSERT INTO sessions (id, name, messages, system_prompt, turn_count, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                messages = excluded.messages,
                system_prompt = excluded.system_prompt,
                turn_count = excluded.turn_count,
                status = excluded.status,
                updated_at = datetime('now')
        `);

        stmt.run(
            session.id,
            session.name,
            JSON.stringify(session.messages),
            session.systemPrompt,
            session.turnCount,
            session.status
        );
    }

    /**
     * Load a session by ID
     */
    load(id: string): SessionData | null {
        const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            messages: JSON.parse(row.messages),
            systemPrompt: row.system_prompt,
            turnCount: row.turn_count,
            status: row.status,
            createdAt: new Date(row.created_at + 'Z'), // SQLite datetime is UTC
            updatedAt: new Date(row.updated_at + 'Z')
        };
    }

    /**
     * List all sessions (metadata only, no messages)
     */
    list(limit = 50): Omit<SessionData, 'messages'>[] {
        const stmt = this.db.prepare(`
            SELECT id, name, system_prompt, turn_count, status, created_at, updated_at
            FROM sessions
            ORDER BY updated_at DESC
            LIMIT ?
        `);

        const rows = stmt.all(limit) as any[];

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            systemPrompt: row.system_prompt,
            turnCount: row.turn_count,
            status: row.status,
            createdAt: new Date(row.created_at + 'Z'),
            updatedAt: new Date(row.updated_at + 'Z')
        }));
    }

    /**
     * Delete a session
     */
    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
