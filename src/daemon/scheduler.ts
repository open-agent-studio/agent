import { Cron } from 'croner';
import { ConfigLoader } from '../config/loader.js';
import { PlanParser } from '../plans/parser.js';
import { PlanRunner } from '../plans/runner.js';
import { ExecutionEngine } from '../engine/executor.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../policy/engine.js';
import { SkillLoader } from '../skills/loader.js';
import { SkillRunner } from '../skills/runner.js';
import { LLMRouter } from '../llm/router.js';
import { generateRunId } from '../utils/paths.js';
import type { ExecutionContext } from '../tools/types.js';

/**
 * Daemon scheduler — runs plans on cron schedules
 * This is the daemon's main loop, started by DaemonManager
 */
export async function startScheduler(): Promise<void> {
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();

    const registry = ToolRegistry.getInstance();
    const policy = new PolicyEngine(config, process.cwd());
    const skillLoader = new SkillLoader(config);
    const llmRouter = new LLMRouter(config);
    const skillRunner = new SkillRunner(registry, policy, llmRouter);
    const engine = new ExecutionEngine(registry, llmRouter, policy, skillLoader, skillRunner);
    const planParser = new PlanParser();
    const planRunner = new PlanRunner(engine, llmRouter);

    await skillLoader.loadAll();

    // Discover plans with cron triggers
    const plans = await planParser.listPlans();
    const cronJobs: Cron[] = [];

    for (const planInfo of plans) {
        try {
            const plan = await planParser.parseFile(planInfo.path);
            if (plan.trigger.type === 'cron' && plan.trigger.cron) {
                const job = new Cron(plan.trigger.cron, {
                    timezone: config.daemon.timezone,
                }, async () => {
                    const ctx: ExecutionContext = {
                        runId: generateRunId(),
                        cwd: process.cwd(),
                        config,
                        autonomous: plan.policy.approvals === 'auto',
                        approvedPermissions: new Set(),
                    };

                    console.log(`[scheduler] Running plan: ${plan.name}`);
                    try {
                        if (plan.mode === 'propose') {
                            await planRunner.propose(plan, ctx);
                            console.log(`[scheduler] Proposed run for plan: ${plan.name}`);
                        } else {
                            const run = await planRunner.run(plan, ctx);
                            console.log(`[scheduler] Plan ${plan.name} completed: ${run.status}`);
                        }
                    } catch (err) {
                        console.error(`[scheduler] Plan ${plan.name} failed: ${(err as Error).message}`);
                    }
                });
                cronJobs.push(job);
                console.log(`[scheduler] Registered cron for ${plan.name}: ${plan.trigger.cron}`);
            }
        } catch (err) {
            console.error(`[scheduler] Failed to load plan ${planInfo.name}: ${(err as Error).message}`);
        }
    }

    console.log(`[scheduler] Started with ${cronJobs.length} cron jobs`);

    // Keep the process alive
    process.on('SIGTERM', () => {
        console.log('[scheduler] Shutting down...');
        for (const job of cronJobs) {
            job.stop();
        }
        process.exit(0);
    });
}

// Auto-start if run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    startScheduler().catch(console.error);
}
