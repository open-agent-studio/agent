import { Cron } from 'croner';
import { watch } from 'chokidar';
import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { MemoryStore } from '../memory/store.js';
import { GoalStore, type Task } from '../goals/store.js';
import { loadTriggers, type TriggerConfig } from './triggers.js';
import { getAgentDir } from '../utils/paths.js';
import { InstanceRegistry } from '../instance/registry.js';
import * as dotenv from 'dotenv';

import { ConfigLoader } from '../config/loader.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../policy/engine.js';
import { SkillLoader } from '../skills/loader.js';
import { LLMRouter } from '../llm/router.js';
import { SkillRunner } from '../skills/runner.js';
import { registerCoreTools } from '../cli/commands/init.js';
import type { LoadedSkill } from '../skills/types.js';

/**
 * Daemon Service — The autonomous agent heartbeat
 *
 * Runs as a long-lived background process that:
 * - Processes the goal/task queue
 * - Watches files for changes
 * - Runs cron-scheduled tasks
 * - Logs all activity
 */
export class DaemonService {
    private cronJobs: Cron[] = [];
    private fileWatchers: ReturnType<typeof watch>[] = [];
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private memoryStore: MemoryStore;
    private goalStore: GoalStore;
    private logPath: string;
    private running = false;
    private startedAt: Date | null = null;
    private instanceRegistry: InstanceRegistry;
    private instanceId: string;
    private stats = {
        tasksProcessed: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        triggersFireCount: 0,
        heartbeats: 0,
    };

    constructor(private workDir: string = process.cwd()) {
        this.memoryStore = MemoryStore.open(workDir);
        this.goalStore = new GoalStore(this.memoryStore);
        this.logPath = path.join(getAgentDir(), 'daemon.log');
        this.instanceRegistry = new InstanceRegistry();
        this.instanceId = `daemon-${Date.now()}`;
    }

    /**
     * Start the daemon service
     */
    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        this.startedAt = new Date();

        // Ensure environment variables from .env are loaded
        dotenv.config({ path: path.join(this.workDir, '.env') });

        // Register the daemon
        await this.instanceRegistry.register({
            id: this.instanceId,
            pid: process.pid,
            cwd: this.workDir,
            port: 0,
            status: 'running',
            project: path.basename(this.workDir)
        });

        await this.log('🟢 Agent daemon started');
        await this.log(`   Working directory: ${this.workDir}`);

        // Load and register triggers
        const triggers = await loadTriggers(this.workDir);
        await this.log(`   Loaded ${triggers.length} trigger(s)`);

        for (const trigger of triggers) {
            await this.registerTrigger(trigger);
        }

        // Start heartbeat (every 60 seconds)
        this.heartbeatTimer = setInterval(() => {
            this.heartbeat();
            this.instanceRegistry.heartbeat(this.instanceId, 'running').catch(() => { });
        }, 60_000);

        // Run initial goal check
        await this.processGoalQueue();

        // Keep the process alive
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());

        await this.log('   Daemon is ready. Waiting for events...');
    }

    /**
     * Register a trigger
     */
    private async registerTrigger(trigger: TriggerConfig): Promise<void> {
        switch (trigger.event) {
            case 'cron':
            case 'goal.check':
                if (trigger.schedule) {
                    const job = new Cron(trigger.schedule, async () => {
                        await this.onTriggerFired(trigger);
                    });
                    this.cronJobs.push(job);
                    await this.log(`   📅 Cron registered: "${trigger.name}" → ${trigger.schedule}`);
                }
                break;

            case 'file.changed':
                if (trigger.watch) {
                    const paths = Array.isArray(trigger.watch) ? trigger.watch : [trigger.watch];
                    const watcher = watch(paths, {
                        cwd: this.workDir,
                        ignoreInitial: true,
                        awaitWriteFinish: {
                            stabilityThreshold: trigger.debounce ?? 2000,
                        },
                    });

                    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

                    const handleChange = (filePath: string) => {
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(async () => {
                            await this.onTriggerFired(trigger, { changedFile: filePath });
                        }, trigger.debounce ?? 2000);
                    };

                    watcher.on('change', handleChange);
                    watcher.on('add', handleChange);

                    this.fileWatchers.push(watcher);
                    await this.log(`   👁️ Watcher registered: "${trigger.name}" → ${paths.join(', ')}`);
                }
                break;

            default:
                await this.log(`   ⚠️ Unknown trigger event: ${trigger.event}`);
        }
    }

    /**
     * Handle a trigger firing
     */
    private async onTriggerFired(trigger: TriggerConfig, _context?: Record<string, any>): Promise<void> {
        this.stats.triggersFireCount++;

        if (trigger.action.type === 'goal-progress') {
            await this.processGoalQueue();
            return;
        }

        if (trigger.action.skill) {
            await this.log(`⚡ Trigger "${trigger.name}" fired → skill: ${trigger.action.skill}`);
            // In a full implementation, this would invoke the skill runner
            // For now, log the trigger and create a task if there's an active goal
            await this.log(`   Skill execution: ${trigger.action.skill} (queued)`);
        }

        if (trigger.action.run) {
            await this.log(`⚡ Trigger "${trigger.name}" fired → run: ${trigger.action.run}`);
            try {
                const { exec } = await import('node:child_process');
                const { promisify } = await import('node:util');
                const execAsync = promisify(exec);
                const { stdout, stderr } = await execAsync(trigger.action.run, {
                    cwd: this.workDir,
                    timeout: 30_000,
                });
                if (stdout) await this.log(`   stdout: ${stdout.trim()}`);
                if (stderr) await this.log(`   stderr: ${stderr.trim()}`);
            } catch (err) {
                await this.log(`   ✗ Command failed: ${(err as Error).message}`);
            }
        }
    }

    /**
     * Process the goal/task queue
     */
    private async processGoalQueue(): Promise<void> {
        const task = this.goalStore.getNextTask();
        if (!task) return;

        this.stats.tasksProcessed++;
        await this.log(`🔄 Processing task #${task.id}: "${task.title}"`);

        this.goalStore.startTask(task.id);

        try {
            // Execute the task
            const result = await this.executeTask(task);

            this.goalStore.completeTask(task.id, result);
            this.stats.tasksCompleted++;
            await this.log(`✅ Task #${task.id} completed: ${result.slice(0, 100)}`);

            // Auto-save completion as a memory
            this.memoryStore.save(
                `Completed task: "${task.title}" — ${result.slice(0, 200)}`,
                'learned',
                'agent',
                ['task', 'completed']
            );

            // Check if there are more tasks to process
            await this.processGoalQueue();

        } catch (err) {
            const error = (err as Error).message;
            this.goalStore.failTask(task.id, error);
            this.stats.tasksFailed++;
            await this.log(`❌ Task #${task.id} failed: ${error}`);
        }
    }

    /**
     * Execute a single task
     */
    private async executeTask(task: Task): Promise<string> {
        try {
            const configLoader = new ConfigLoader(this.workDir);
            const config = await configLoader.load();

            const registry = ToolRegistry.getInstance();
            registerCoreTools(registry);

            const policy = new PolicyEngine(config, this.workDir);
            const llmRouter = new LLMRouter(config);
            const skillLoader = new SkillLoader(config);

            await skillLoader.loadAll();

            let loadedSkill: LoadedSkill | undefined;

            if (task.skill) {
                loadedSkill = skillLoader.get(task.skill);
            }

            // If no explicit skill matches, generate an ephemeral skill for free-form instructions
            if (!loadedSkill) {
                loadedSkill = {
                    path: this.workDir,
                    manifest: {
                        name: `ephemeral-task-${task.id}`,
                        version: '1.0.0',
                        description: task.title,
                        inputs: {},
                        tools: ['*'],
                        permissions: { required: ['*'] as any },
                        entrypoint: 'prompt.md'
                    },
                    promptContent: `# Task Details\n\nTitle: ${task.title}\n\nDescription: ${task.description || 'No additional description provided.'}\n\nInput Context:\n${JSON.stringify(task.input || {}, null, 2)}\n\nPlease execute this task using the available tools.`
                };
            }

            const runner = new SkillRunner(registry, policy, llmRouter);
            const result = await runner.run(loadedSkill, task.input || {}, {
                cwd: this.workDir,
                runId: `daemon-task-${task.id}`,
                config,
                approvedPermissions: new Set(['*']),
                autonomous: true,
            });

            if (result.success) {
                return typeof result.output === 'string'
                    ? result.output
                    : JSON.stringify(result.output, null, 2);
            } else {
                throw new Error(result.error || 'Task execution failed');
            }
        } catch (err) {
            throw new Error(`Failed to execute task: ${(err as Error).message}`);
        }
    }

    /**
     * Heartbeat — periodic health check
     */
    private async heartbeat(): Promise<void> {
        if (!this.running) return;
        this.stats.heartbeats++;

        // Check for pending approvals
        const approvals = this.goalStore.getPendingApprovals();
        if (approvals.length > 0) {
            await this.log(`💡 ${approvals.length} task(s) awaiting approval`);
        }

        // Check for active goals
        const goalStats = this.goalStore.stats();
        if (goalStats.runningTasks > 0 || goalStats.pendingTasks > 0) {
            await this.log(
                `📊 Heartbeat: ${goalStats.activeGoals} goals, ` +
                `${goalStats.pendingTasks} pending, ${goalStats.runningTasks} running`
            );
        }

        // Auto-start processing if tasks are pending
        if (goalStats.pendingTasks > 0 && goalStats.runningTasks === 0) {
            await this.processGoalQueue();
        }
    }

    /**
     * Graceful shutdown
     */
    private async shutdown(): Promise<void> {
        await this.log('🔴 Daemon shutting down...');
        this.running = false;

        // Stop heartbeat
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        // Stop cron jobs
        for (const job of this.cronJobs) {
            job.stop();
        }

        // Stop file watchers
        for (const watcher of this.fileWatchers) {
            await watcher.close();
        }

        const uptime = this.getUptime();
        await this.log(
            `   Uptime: ${uptime} | ` +
            `Tasks: ${this.stats.tasksProcessed} processed, ` +
            `${this.stats.tasksCompleted} completed, ` +
            `${this.stats.tasksFailed} failed`
        );
        await this.log('   Goodbye.\n');

        await this.instanceRegistry.unregister(this.instanceId).catch(() => { });

        process.exit(0);
    }

    /**
     * Get daemon uptime as human-readable string
     */
    private getUptime(): string {
        if (!this.startedAt) return '0s';
        const ms = Date.now() - this.startedAt.getTime();
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / 60000) % 60;
        const hours = Math.floor(ms / 3600000) % 24;
        const days = Math.floor(ms / 86400000);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        return parts.join(' ');
    }

    /**
     * Get current daemon status
     */
    getStatus() {
        return {
            running: this.running,
            startedAt: this.startedAt?.toISOString() ?? null,
            uptime: this.getUptime(),
            stats: { ...this.stats },
            cronJobs: this.cronJobs.length,
            fileWatchers: this.fileWatchers.length,
        };
    }

    /**
     * Log a message to the daemon log file
     */
    private async log(message: string): Promise<void> {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${message}\n`;

        // Ensure log directory exists
        await mkdir(path.dirname(this.logPath), { recursive: true });
        await appendFile(this.logPath, line, 'utf-8');

        // Also print to stdout (visible in daemon logs)
        console.log(`${timestamp.slice(11, 19)} ${message}`);
    }
}

// Auto-start if run as the daemon process
if (process.argv[1]?.endsWith('service.js')) {
    const service = new DaemonService();
    service.start().catch(err => {
        console.error('Fatal daemon error:', err);
        process.exit(1);
    });
}
