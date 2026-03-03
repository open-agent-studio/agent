import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ToolRegistry } from '../../tools/registry.js';
import type { ToolResult, ExecutionContext } from '../../tools/types.js';
import { z } from 'zod';

/**
 * Cost Tracking Plugin — Tracks LLM token usage and cost per task/goal
 */

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

interface CostEntry {
    timestamp: string;
    taskId?: number;
    goalId?: number;
    model: string;
    provider: string;
    usage: TokenUsage;
    costUsd: number;
    label: string;
}

export interface CostSummary {
    totalCostUsd: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    entryCount: number;
    byModel: Record<string, { cost: number; tokens: number; calls: number }>;
    byDay: Record<string, { cost: number; tokens: number; calls: number }>;
    last7Days: number;
    last30Days: number;
}

// Pricing per 1M tokens (input / output) — updated March 2026
const PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku': { input: 0.80, output: 4.00 },
    // Ollama / local = free
    'llama3': { input: 0, output: 0 },
    'codellama': { input: 0, output: 0 },
    'mistral': { input: 0, output: 0 },
};

export class CostTracker {
    private dbPath: string;
    private entries: CostEntry[] = [];
    private loaded = false;

    constructor(workDir: string) {
        this.dbPath = path.join(workDir, '.agent', 'cost-tracking.json');
    }

    private async load(): Promise<void> {
        if (this.loaded) return;
        try {
            const raw = await readFile(this.dbPath, 'utf-8');
            this.entries = JSON.parse(raw);
        } catch {
            this.entries = [];
        }
        this.loaded = true;
    }

    private async save(): Promise<void> {
        await mkdir(path.dirname(this.dbPath), { recursive: true });
        await writeFile(this.dbPath, JSON.stringify(this.entries, null, 2), 'utf-8');
    }

    /**
     * Calculate cost for a token usage
     */
    private calculateCost(model: string, usage: TokenUsage): number {
        // Find best matching pricing key
        const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || '';
        const pricing = PRICING[key];
        if (!pricing) return 0;

        const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
        const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
        return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
    }

    /**
     * Record a usage event
     */
    async record(opts: {
        taskId?: number;
        goalId?: number;
        model: string;
        provider: string;
        usage: TokenUsage;
        label: string;
    }): Promise<CostEntry> {
        await this.load();

        const entry: CostEntry = {
            timestamp: new Date().toISOString(),
            taskId: opts.taskId,
            goalId: opts.goalId,
            model: opts.model,
            provider: opts.provider,
            usage: opts.usage,
            costUsd: this.calculateCost(opts.model, opts.usage),
            label: opts.label,
        };

        this.entries.push(entry);
        await this.save();
        return entry;
    }

    /**
     * Get cost summary
     */
    async getSummary(): Promise<CostSummary> {
        await this.load();

        const now = Date.now();
        const day7 = now - 7 * 24 * 60 * 60 * 1000;
        const day30 = now - 30 * 24 * 60 * 60 * 1000;

        const summary: CostSummary = {
            totalCostUsd: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            entryCount: this.entries.length,
            byModel: {},
            byDay: {},
            last7Days: 0,
            last30Days: 0,
        };

        for (const entry of this.entries) {
            summary.totalCostUsd += entry.costUsd;
            summary.totalTokens += entry.usage.totalTokens;
            summary.totalPromptTokens += entry.usage.promptTokens;
            summary.totalCompletionTokens += entry.usage.completionTokens;

            // By model
            if (!summary.byModel[entry.model]) {
                summary.byModel[entry.model] = { cost: 0, tokens: 0, calls: 0 };
            }
            summary.byModel[entry.model].cost += entry.costUsd;
            summary.byModel[entry.model].tokens += entry.usage.totalTokens;
            summary.byModel[entry.model].calls += 1;

            // By day
            const day = entry.timestamp.slice(0, 10);
            if (!summary.byDay[day]) {
                summary.byDay[day] = { cost: 0, tokens: 0, calls: 0 };
            }
            summary.byDay[day].cost += entry.costUsd;
            summary.byDay[day].tokens += entry.usage.totalTokens;
            summary.byDay[day].calls += 1;

            // Time-based
            const ts = new Date(entry.timestamp).getTime();
            if (ts >= day7) summary.last7Days += entry.costUsd;
            if (ts >= day30) summary.last30Days += entry.costUsd;
        }

        // Round
        summary.totalCostUsd = Math.round(summary.totalCostUsd * 1_000_000) / 1_000_000;
        summary.last7Days = Math.round(summary.last7Days * 1_000_000) / 1_000_000;
        summary.last30Days = Math.round(summary.last30Days * 1_000_000) / 1_000_000;

        return summary;
    }

    /**
     * Get recent entries
     */
    async getRecent(limit = 50): Promise<CostEntry[]> {
        await this.load();
        return this.entries.slice(-limit);
    }
}

/**
 * Register cost tracking tools
 */
export function registerCostTools(registry: ToolRegistry, workDir: string): void {
    const tracker = new CostTracker(workDir);

    if (!registry.has('cost.summary')) {
        registry.register({
            name: 'cost.summary',
            category: 'info',
            description: 'Get a summary of LLM token usage and costs. Shows total spend, breakdown by model and day.',
            inputSchema: z.object({}),
            outputSchema: z.any(),
            permissions: [] as any,
            execute: async (_input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
                const start = Date.now();
                try {
                    const summary = await tracker.getSummary();
                    return { success: true, data: summary, durationMs: Date.now() - start };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
                }
            },
        } as any);
    }

    if (!registry.has('cost.recent')) {
        registry.register({
            name: 'cost.recent',
            category: 'info',
            description: 'Get the most recent cost entries, showing per-call token usage and cost.',
            inputSchema: z.object({
                limit: z.number().optional().describe('Number of entries to return (default: 20)'),
            }),
            outputSchema: z.any(),
            permissions: [] as any,
            execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
                const start = Date.now();
                try {
                    const entries = await tracker.getRecent(input.limit || 20);
                    return { success: true, data: entries, durationMs: Date.now() - start };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
                }
            },
        } as any);
    }
}
