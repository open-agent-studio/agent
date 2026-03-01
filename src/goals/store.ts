import Database from 'better-sqlite3';
import { MemoryStore } from '../memory/store.js';

/**
 * Goal & Task management for autonomous execution
 */

export interface Goal {
    id: number;
    title: string;
    description: string | null;
    status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
    priority: number;
    created_at: string;
    updated_at: string;
    deadline: string | null;
    parent_goal_id: number | null;
    progress: number;
    metadata: Record<string, any>;
}

export interface Task {
    id: number;
    goal_id: number;
    title: string;
    description: string | null;
    status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
    skill: string | null;
    input: Record<string, any>;
    output: string | null;
    depends_on: number[];
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    retry_count: number;
    max_retries: number;
    error: string | null;
    requires_approval: boolean;
    approved_at: string | null;
    created_at: string;
    recurrence: string | null;
}

export class GoalStore {
    private db: Database.Database;

    constructor(memoryStore: MemoryStore) {
        // Reuse the same database from MemoryStore
        this.db = (memoryStore as any).db;
        this.ensureRecurrenceColumn();
    }

    /**
     * Migration: add recurrence column if it doesn't exist
     */
    private ensureRecurrenceColumn(): void {
        try {
            this.db.prepare("SELECT recurrence FROM tasks LIMIT 1").get();
        } catch {
            this.db.prepare("ALTER TABLE tasks ADD COLUMN recurrence TEXT").run();
        }
    }

    // ─── Goal Operations ──────────────────────────────────────

    /**
     * Create a new goal
     */
    addGoal(
        title: string,
        options: {
            description?: string;
            priority?: number;
            deadline?: string;
            parentGoalId?: number;
        } = {}
    ): Goal {
        const stmt = this.db.prepare(`
            INSERT INTO goals (title, description, priority, deadline, parent_goal_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            title,
            options.description ?? null,
            options.priority ?? 5,
            options.deadline ?? null,
            options.parentGoalId ?? null
        );

        this.logAudit('goal.created', 'goal', result.lastInsertRowid as number, title);
        return this.getGoal(result.lastInsertRowid as number)!;
    }

    /**
     * Get a goal by ID
     */
    getGoal(id: number): Goal | null {
        const row = this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as any;
        if (!row) return null;
        return { ...row, metadata: JSON.parse(row.metadata || '{}') };
    }

    /**
     * List goals by status
     */
    listGoals(status?: Goal['status']): Goal[] {
        let rows: any[];
        if (status) {
            rows = this.db.prepare(
                'SELECT * FROM goals WHERE status = ? ORDER BY priority ASC, created_at DESC'
            ).all(status);
        } else {
            rows = this.db.prepare(
                'SELECT * FROM goals ORDER BY status ASC, priority ASC, created_at DESC'
            ).all();
        }
        return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
    }

    /**
     * Update goal status
     */
    updateGoalStatus(id: number, status: Goal['status']): void {
        this.db.prepare(`
            UPDATE goals SET status = ?, updated_at = datetime('now') WHERE id = ?
        `).run(status, id);
        this.logAudit(`goal.${status}`, 'goal', id, `Goal #${id} → ${status}`);
    }

    /**
     * Update goal progress (0.0 to 1.0)
     */
    updateGoalProgress(id: number): void {
        const tasks = this.listTasks(id);
        if (tasks.length === 0) return;

        const completed = tasks.filter(t => t.status === 'completed').length;
        const progress = completed / tasks.length;

        this.db.prepare(`
            UPDATE goals SET progress = ?, updated_at = datetime('now') WHERE id = ?
        `).run(progress, id);

        // Auto-complete goal if all tasks done — but NOT if it has recurring tasks
        if (progress >= 1.0 && !this.hasRecurringTasks(id)) {
            this.updateGoalStatus(id, 'completed');
        }
    }

    /**
     * Delete a goal and its tasks
     */
    removeGoal(id: number): boolean {
        const result = this.db.prepare('DELETE FROM goals WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // ─── Task Operations ──────────────────────────────────────

    /**
     * Add a task to a goal
     */
    addTask(
        goalId: number,
        title: string,
        options: {
            description?: string;
            skill?: string;
            input?: Record<string, any>;
            dependsOn?: number[];
            requiresApproval?: boolean;
            scheduledAt?: string;
            recurrence?: string;
        } = {}
    ): Task {
        const stmt = this.db.prepare(`
            INSERT INTO tasks (goal_id, title, description, skill, input, depends_on, requires_approval, scheduled_at, recurrence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            goalId,
            title,
            options.description ?? null,
            options.skill ?? null,
            JSON.stringify(options.input ?? {}),
            JSON.stringify(options.dependsOn ?? []),
            options.requiresApproval ? 1 : 0,
            options.scheduledAt ?? null,
            options.recurrence ?? null
        );

        this.logAudit('task.created', 'task', result.lastInsertRowid as number, title);
        return this.getTask(result.lastInsertRowid as number)!;
    }

    /**
     * Get a task by ID
     */
    getTask(id: number): Task | null {
        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
        if (!row) return null;
        return this.parseTask(row);
    }

    /**
     * List tasks for a goal
     */
    listTasks(goalId: number): Task[] {
        const rows = this.db.prepare(
            'SELECT * FROM tasks WHERE goal_id = ? ORDER BY id ASC'
        ).all(goalId);
        return (rows as any[]).map(r => this.parseTask(r));
    }

    /**
     * Get the next executable task (respects dependencies)
     */
    getNextTask(): Task | null {
        // Get all pending/queued tasks ordered by goal priority
        // Only pick tasks whose scheduled_at is null or in the past
        const candidates = this.db.prepare(`
            SELECT t.* FROM tasks t
            JOIN goals g ON t.goal_id = g.id
            WHERE t.status IN ('pending', 'queued')
            AND g.status = 'active'
            AND (t.scheduled_at IS NULL OR t.scheduled_at <= datetime('now'))
            ORDER BY g.priority ASC, t.id ASC
        `).all() as any[];

        for (const row of candidates) {
            const task = this.parseTask(row);

            // Check dependencies
            if (task.depends_on.length > 0) {
                const deps = task.depends_on.map(id => this.getTask(id));
                const allMet = deps.every(d => d?.status === 'completed');
                if (!allMet) continue;
            }

            // Check if approval is needed and granted
            if (task.requires_approval && !task.approved_at) continue;

            return task;
        }

        return null;
    }

    /**
     * Get active goals that have zero tasks (need decomposition)
     */
    getGoalsNeedingDecomposition(): Goal[] {
        const rows = this.db.prepare(`
            SELECT g.* FROM goals g
            WHERE g.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.goal_id = g.id)
            ORDER BY g.priority ASC
        `).all() as any[];
        return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
    }

    /**
     * Check if a goal has any recurring tasks
     */
    hasRecurringTasks(goalId: number): boolean {
        const row = this.db.prepare(`
            SELECT COUNT(*) as c FROM tasks
            WHERE goal_id = ? AND recurrence IS NOT NULL
        `).get(goalId) as any;
        return row.c > 0;
    }

    /**
     * Mark task as running
     */
    startTask(id: number): void {
        this.db.prepare(`
            UPDATE tasks SET status = 'running', started_at = datetime('now') WHERE id = ?
        `).run(id);
        this.logAudit('task.started', 'task', id, `Task #${id} started`);
    }

    /**
     * Mark task as completed
     */
    completeTask(id: number, output: string): void {
        this.db.prepare(`
            UPDATE tasks SET status = 'completed', output = ?, completed_at = datetime('now')
            WHERE id = ?
        `).run(output, id);
        this.logAudit('task.completed', 'task', id, `Task #${id} completed`);

        // Update goal progress
        const task = this.getTask(id);
        if (task) this.updateGoalProgress(task.goal_id);
    }

    /**
     * Mark task as failed
     */
    failTask(id: number, error: string): void {
        const task = this.getTask(id);
        if (!task) return;

        if (task.retry_count < task.max_retries) {
            // Retry
            this.db.prepare(`
                UPDATE tasks SET status = 'pending', retry_count = retry_count + 1, error = ?
                WHERE id = ?
            `).run(error, id);
            this.logAudit('task.retry', 'task', id, `Task #${id} retry ${task.retry_count + 1}/${task.max_retries}: ${error}`);
        } else {
            // Final failure
            this.db.prepare(`
                UPDATE tasks SET status = 'failed', error = ?, completed_at = datetime('now')
                WHERE id = ?
            `).run(error, id);
            this.logAudit('task.failed', 'task', id, `Task #${id} failed: ${error}`);
        }
    }

    /**
     * Approve a task that requires human approval
     */
    approveTask(id: number): boolean {
        const result = this.db.prepare(`
            UPDATE tasks SET approved_at = datetime('now'), status = 'queued'
            WHERE id = ? AND requires_approval = 1
        `).run(id);
        if (result.changes > 0) {
            this.logAudit('task.approved', 'task', id, `Task #${id} approved`);
        }
        return result.changes > 0;
    }

    /**
     * Get recent errors for a specific skill
     */
    getSkillErrors(skillName: string, limit = 5): string[] {
        const stmt = this.db.prepare(`
            SELECT error, output FROM tasks 
            WHERE skill = ? AND (status IN ('failed', 'blocked') OR error IS NOT NULL)
            ORDER BY created_at DESC 
            LIMIT ?
        `);

        const rows = stmt.all(skillName, limit) as any[];
        return rows.map(r => r.error || r.output || 'Unknown error');
    }

    /**
     * Get tasks waiting for approval
     */
    getPendingApprovals(): Task[] {
        const rows = this.db.prepare(`
            SELECT * FROM tasks
            WHERE requires_approval = 1 AND approved_at IS NULL
            AND status NOT IN ('cancelled', 'completed', 'failed')
            ORDER BY id ASC
        `).all();
        return (rows as any[]).map(r => this.parseTask(r));
    }

    /**
     * Get summary stats
     */
    stats(): {
        activeGoals: number;
        completedGoals: number;
        pendingTasks: number;
        runningTasks: number;
        completedTasks: number;
        failedTasks: number;
        awaitingApproval: number;
    } {

        return {
            activeGoals: (this.db.prepare("SELECT COUNT(*) as c FROM goals WHERE status = 'active'").get() as any).c,
            completedGoals: (this.db.prepare("SELECT COUNT(*) as c FROM goals WHERE status = 'completed'").get() as any).c,
            pendingTasks: (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','queued')").get() as any).c,
            runningTasks: (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'running'").get() as any).c,
            completedTasks: (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'completed'").get() as any).c,
            failedTasks: (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'failed'").get() as any).c,
            awaitingApproval: (this.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE requires_approval = 1 AND approved_at IS NULL AND status NOT IN ('cancelled','completed','failed')").get() as any).c,
        };
    }

    // ─── Helpers ──────────────────────────────────────────────

    private parseTask(row: any): Task {
        return {
            ...row,
            input: JSON.parse(row.input || '{}'),
            depends_on: JSON.parse(row.depends_on || '[]'),
            requires_approval: !!row.requires_approval,
            recurrence: row.recurrence ?? null,
        };
    }

    private logAudit(eventType: string, entityType: string, entityId: number, details: string): void {
        this.db.prepare(`
            INSERT INTO audit_events (event_type, entity_type, entity_id, action, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(eventType, entityType, entityId, eventType, details);
    }
}
