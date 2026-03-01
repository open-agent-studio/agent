import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * Memory Store — Persistent agent memory backed by SQLite + FTS5
 *
 * Stores facts, project context, and learned information
 * that persists across sessions.
 */

export interface Memory {
    id: number;
    content: string;
    category: 'project' | 'preference' | 'fact' | 'learned' | 'general';
    source: 'user' | 'agent' | 'auto';
    tags: string[];
    created_at: string;
    accessed_at: string | null;
    relevance_score: number;
}

export interface MemorySearchResult extends Memory {
    rank: number;
}

export class MemoryStore {
    private db: Database.Database;
    private static instance: MemoryStore | null = null;

    constructor(dbPath: string) {
        // Ensure directory exists
        mkdirSync(path.dirname(dbPath), { recursive: true });

        this.db = new Database(dbPath);

        // Enable WAL mode for better concurrent performance
        this.db.pragma('journal_mode = WAL');

        this.migrate();
    }

    /**
     * Get singleton instance scoped to a working directory
     */
    static open(workDir: string): MemoryStore {
        const dbPath = path.join(workDir, '.agent', 'memory.db');
        if (!MemoryStore.instance || (MemoryStore.instance as any)._path !== dbPath) {
            MemoryStore.instance = new MemoryStore(dbPath);
            (MemoryStore.instance as any)._path = dbPath;
        }
        return MemoryStore.instance;
    }

    /**
     * Run database migrations
     */
    private migrate(): void {
        this.db.exec(`
            -- Memories table
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                category TEXT DEFAULT 'general'
                    CHECK(category IN ('project','preference','fact','learned','general')),
                source TEXT DEFAULT 'user'
                    CHECK(source IN ('user','agent','auto')),
                tags TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT (datetime('now')),
                accessed_at DATETIME,
                relevance_score REAL DEFAULT 1.0
            );

            -- Full-text search index
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content, category, tags,
                content='memories',
                content_rowid='id'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, content, category, tags)
                VALUES (new.id, new.content, new.category, new.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content, category, tags)
                VALUES ('delete', old.id, old.content, old.category, old.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, content, category, tags)
                VALUES ('delete', old.id, old.content, old.category, old.tags);
                INSERT INTO memories_fts(rowid, content, category, tags)
                VALUES (new.id, new.content, new.category, new.tags);
            END;

            -- Goals table
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active'
                    CHECK(status IN ('active','paused','completed','failed','cancelled')),
                priority INTEGER DEFAULT 5
                    CHECK(priority BETWEEN 1 AND 10),
                created_at DATETIME DEFAULT (datetime('now')),
                updated_at DATETIME DEFAULT (datetime('now')),
                deadline DATETIME,
                parent_goal_id INTEGER REFERENCES goals(id),
                progress REAL DEFAULT 0.0,
                metadata TEXT DEFAULT '{}'
            );

            -- Tasks table
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending'
                    CHECK(status IN ('pending','queued','running','completed','failed','blocked','cancelled')),
                skill TEXT,
                input TEXT DEFAULT '{}',
                output TEXT,
                depends_on TEXT DEFAULT '[]',
                scheduled_at DATETIME,
                started_at DATETIME,
                completed_at DATETIME,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                error TEXT,
                requires_approval BOOLEAN DEFAULT 0,
                approved_at DATETIME,
                recurrence TEXT,
                created_at DATETIME DEFAULT (datetime('now'))
            );

            -- Audit events table
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT (datetime('now'))
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

            -- Skill Metrics table
            CREATE TABLE IF NOT EXISTS skill_metrics (
                skill TEXT PRIMARY KEY,
                calls INTEGER DEFAULT 0,
                successes INTEGER DEFAULT 0,
                failures INTEGER DEFAULT 0,
                total_duration_ms INTEGER DEFAULT 0,
                last_used DATETIME
            );
        `);
    }

    // ─── Memory Operations ─────────────────────────────────────

    /**
     * Save a new memory
     */
    save(
        content: string,
        category: Memory['category'] = 'general',
        source: Memory['source'] = 'user',
        tags: string[] = []
    ): Memory {
        const stmt = this.db.prepare(`
            INSERT INTO memories (content, category, source, tags)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(content, category, source, JSON.stringify(tags));

        this.logAudit('memory.save', 'memory', result.lastInsertRowid as number, content);

        return this.getMemory(result.lastInsertRowid as number)!;
    }

    /**
     * Search memories using full-text search
     */
    search(query: string, limit = 10): MemorySearchResult[] {
        const stmt = this.db.prepare(`
            SELECT m.*, fts.rank
            FROM memories_fts fts
            JOIN memories m ON m.id = fts.rowid
            WHERE memories_fts MATCH ?
            ORDER BY fts.rank
            LIMIT ?
        `);

        // Sanitize query for FTS5: remove special chars that break syntax
        // or wrap in quotes if you want exact match. 
        // For now, let's just strip non-alphanumeric except spaces.
        const safeQuery = query.replace(/[^\w\s]/g, ' ').trim();

        // If query becomes empty after sanitization, return empty results
        if (!safeQuery) return [];

        // Use OR logic for multiple terms for broader context
        const ftsQuery = safeQuery.split(/\s+/).join(' OR ');

        const results = stmt.all(ftsQuery, limit) as any[];

        // Update accessed_at for returned memories
        const updateStmt = this.db.prepare(`
            UPDATE memories SET accessed_at = datetime('now') WHERE id = ?
        `);
        for (const r of results) {
            updateStmt.run(r.id);
        }

        return results.map(r => ({
            ...r,
            tags: JSON.parse(r.tags || '[]'),
        }));
    }

    /**
     * Get all memories, optionally filtered by category
     */
    list(category?: Memory['category'], limit = 50): Memory[] {
        let stmt;
        if (category) {
            stmt = this.db.prepare(`
                SELECT * FROM memories WHERE category = ?
                ORDER BY created_at DESC LIMIT ?
            `);
            return (stmt.all(category, limit) as any[]).map(r => ({
                ...r,
                tags: JSON.parse(r.tags || '[]'),
            }));
        }
        stmt = this.db.prepare(`
            SELECT * FROM memories ORDER BY created_at DESC LIMIT ?
        `);
        return (stmt.all(limit) as any[]).map(r => ({
            ...r,
            tags: JSON.parse(r.tags || '[]'),
        }));
    }

    /**
     * Get a specific memory by ID
     */
    getMemory(id: number): Memory | null {
        const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return { ...row, tags: JSON.parse(row.tags || '[]') };
    }

    /**
     * Delete a memory
     */
    forget(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
        const result = stmt.run(id);
        if (result.changes > 0) {
            this.logAudit('memory.forget', 'memory', id, `Deleted memory #${id}`);
        }
        return result.changes > 0;
    }

    /**
     * Get relevant context for an LLM prompt
     * Searches memories and returns formatted context
     */
    getContext(query: string, maxTokens = 500): string {
        const results = this.search(query, 5);
        if (results.length === 0) return '';

        const lines = results.map(r =>
            `- [${r.category}] ${r.content}`
        );

        const context = lines.join('\n');

        // Rough token estimate (4 chars ≈ 1 token)
        if (context.length > maxTokens * 4) {
            return context.slice(0, maxTokens * 4) + '\n...';
        }

        return context;
    }

    /**
     * Get memory count and stats
     */
    stats(): { total: number; byCategory: Record<string, number>; bySource: Record<string, number> } {
        const total = (this.db.prepare('SELECT COUNT(*) as c FROM memories').get() as any).c;

        const byCat = this.db.prepare(
            'SELECT category, COUNT(*) as c FROM memories GROUP BY category'
        ).all() as any[];

        const bySrc = this.db.prepare(
            'SELECT source, COUNT(*) as c FROM memories GROUP BY source'
        ).all() as any[];

        return {
            total,
            byCategory: Object.fromEntries(byCat.map(r => [r.category, r.c])),
            bySource: Object.fromEntries(bySrc.map(r => [r.source, r.c])),
        };
    }

    // ─── Audit Operations ─────────────────────────────────────

    private logAudit(eventType: string, entityType: string, entityId: number, details: string): void {
        this.db.prepare(`
            INSERT INTO audit_events (event_type, entity_type, entity_id, action, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(eventType, entityType, entityId, eventType, details);
    }

    getAuditLog(limit = 20): any[] {
        return this.db.prepare(
            'SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?'
        ).all(limit);
    }

    /**
     * Get activity for a specific date (default: today)
     */
    getDailyActivity(date: Date = new Date()): any[] {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.db.prepare(`
            SELECT * FROM audit_events 
            WHERE created_at BETWEEN ? AND ?
            ORDER BY created_at ASC
        `).all(startOfDay.toISOString(), endOfDay.toISOString());
    }

    // ─── Skill Metrics ───────────────────────────────────────

    /**
     * Record usage of a skill
     */
    recordSkillMetric(skill: string, success: boolean, durationMs: number): void {
        const stmt = this.db.prepare(`
            INSERT INTO skill_metrics (skill, calls, successes, failures, total_duration_ms, last_used)
            VALUES (?, 1, ?, ?, ?, datetime('now'))
            ON CONFLICT(skill) DO UPDATE SET
                calls = calls + 1,
                successes = successes + (excluded.successes),
                failures = failures + (excluded.failures),
                total_duration_ms = total_duration_ms + excluded.total_duration_ms,
                last_used = datetime('now')
        `);
        stmt.run(
            skill,
            success ? 1 : 0,
            success ? 0 : 1,
            durationMs
        );
    }

    /**
     * Get metrics for all skills
     */
    getSkillMetrics(): any[] {
        return this.db.prepare('SELECT * FROM skill_metrics ORDER BY calls DESC').all();
    }

    // ─── Cleanup ─────────────────────────────────────────────

    close(): void {
        this.db.close();
        MemoryStore.instance = null;
    }
}
