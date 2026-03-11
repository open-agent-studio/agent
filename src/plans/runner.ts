import type { Plan, PlanRun } from './types.js';
import type { ExecutionContext } from '../tools/types.js';
import { ExecutionEngine } from '../engine/executor.js';
import { AuditLogger } from '../logging/audit-log.js';
import { auditEmitter, AuditEventType } from '../policy/audit.js';
import { generateRunId } from '../utils/paths.js';
import type { HookRegistry } from '../hooks/registry.js';
import { PlanCorrector } from './corrector.js';
import type { LLMRouter } from '../llm/router.js';

/**
 * Plan runner — executes plan steps sequentially
 */
export class PlanRunner {
    private engine: ExecutionEngine;
    private hooks?: HookRegistry;
    private corrector: PlanCorrector;

    constructor(engine: ExecutionEngine, router: LLMRouter, hooks?: HookRegistry) {
        this.engine = engine;
        this.hooks = hooks;
        this.corrector = new PlanCorrector(router);
    }

    /**
     * Execute a plan
     */
    async run(plan: Plan, ctx: ExecutionContext): Promise<PlanRun> {
        const runId = ctx.runId ?? generateRunId();
        const auditLogger = new AuditLogger(runId, plan.name);
        await auditLogger.init();

        const planRun: PlanRun = {
            runId,
            planName: plan.name,
            status: 'running',
            steps: plan.steps.map((s) => ({
                stepId: s.id,
                status: 'pending' as const,
            })),
            startedAt: new Date().toISOString(),
            triggeredBy: 'cli',
        };

        auditEmitter.emit(AuditEventType.RUN_START, {
            runId,
            planName: plan.name,
            stepCount: plan.steps.length,
        });

        ctx.onProgress?.(`Starting plan: ${plan.name} (${plan.steps.length} steps)`);

        // Hook: before:plan
        if (this.hooks) {
            await this.hooks.dispatch({
                event: 'before:plan',
                name: plan.name,
                cwd: ctx.cwd,
                runId,
            });
        }

        try {
            for (const step of plan.steps) {
                const stepRun = planRun.steps.find((s) => s.stepId === step.id)!;

                // Check dependencies
                if (step.dependsOn) {
                    const unmetDeps = step.dependsOn.filter((depId) => {
                        const dep = planRun.steps.find((s) => s.stepId === depId);
                        return !dep || dep.status !== 'completed';
                    });
                    if (unmetDeps.length > 0) {
                        stepRun.status = 'skipped';
                        stepRun.error = `Unmet dependencies: ${unmetDeps.join(', ')}`;
                        continue;
                    }
                }

                ctx.onProgress?.(`Step ${step.id}: ${step.name}`);
                stepRun.status = 'running';

                auditEmitter.emit(AuditEventType.STEP_START, {
                    stepId: step.id,
                    skill: step.skill,
                    tool: step.tool,
                });

                auditLogger.addStep({
                    stepId: step.id,
                    skill: step.skill,
                    tool: step.tool,
                    startedAt: new Date().toISOString(),
                    status: 'running',
                    input: step.args,
                });

                // Execute the step
                const result = await this.engine.executeStep(step, ctx);

                stepRun.status = result.success ? 'completed' : 'failed';
                stepRun.output = result.output;
                stepRun.error = result.error;
                stepRun.durationMs = result.durationMs;

                // Run verification
                if (step.verify && result.success) {
                    const verification = await this.engine.verify(step.verify, ctx);
                    stepRun.verification = verification;

                    if (!verification.passed) {
                        stepRun.status = 'failed';
                        stepRun.error = `Verification failed: ${verification.details}`;
                    }
                }

                auditLogger.updateStep(step.id, {
                    completedAt: new Date().toISOString(),
                    status: stepRun.status,
                    output: result.output as Record<string, unknown>,
                    error: stepRun.error,
                    verification: stepRun.verification,
                });

                auditEmitter.emit(
                    stepRun.status === 'completed'
                        ? AuditEventType.STEP_COMPLETE
                        : AuditEventType.STEP_FAILED,
                    { stepId: step.id, status: stepRun.status, error: stepRun.error }
                );

                // Hook: after:step
                if (this.hooks) {
                    await this.hooks.dispatch({
                        event: 'after:step',
                        name: step.id,
                        args: step.args,
                        result: { success: stepRun.status === 'completed', output: stepRun.output, error: stepRun.error },
                        cwd: ctx.cwd,
                        runId,
                    });
                }

                // Handle failures
                if (stepRun.status === 'failed') {
                    const action = step.onFailure ?? 'abort';

                    if (action === 'retry' && (step.retries ?? 0) > 0) {
                        // existing retry logic
                        let retried = false;
                        for (let attempt = 1; attempt <= (step.retries ?? 0); attempt++) {
                            ctx.onProgress?.(`Retrying step ${step.id} (attempt ${attempt}/${step.retries})`);
                            const retryResult = await this.engine.executeStep(step, ctx);
                            if (retryResult.success) {
                                stepRun.status = 'completed';
                                stepRun.output = retryResult.output;
                                stepRun.error = undefined;
                                retried = true;
                                break;
                            }
                        }
                        if (retried) continue;
                    }

                    // OODA Loop: If not retried or retries failed, attempt dynamic recovery before aborting
                    ctx.onProgress?.(`Step failed. Analyzing failure and planning recovery for ${step.name}...`);

                    const recoverySteps = await this.corrector.generateCorrections(
                        step,
                        stepRun.error || 'Unknown error',
                        {} // Extend with actual agent context/memory if needed
                    );

                    if (recoverySteps && recoverySteps.length > 0) {
                        ctx.onProgress?.(`Generated ${recoverySteps.length} recovery steps. Splicing into plan.`);

                        // Insert new steps into the plan
                        const currentIndex = plan.steps.findIndex(s => s.id === step.id);
                        plan.steps.splice(currentIndex + 1, 0, ...recoverySteps);

                        // Also update the running state tracker
                        const newStepRuns = recoverySteps.map(s => ({
                            stepId: s.id,
                            status: 'pending' as const,
                        }));
                        planRun.steps.splice(currentIndex + 1, 0, ...newStepRuns);

                        // Give them a chance to fix it, but don't mark current as success
                        // We will proceed to the newly injected steps
                        continue;
                    } else if (action === 'abort') {
                        planRun.status = 'failed';
                        break;
                    }
                    // 'skip' falls through to next step
                }
            }

            if (planRun.status === 'running') {
                planRun.status = 'completed';
            }
        } catch (err) {
            planRun.status = 'failed';
        }

        planRun.completedAt = new Date().toISOString();

        auditEmitter.emit(AuditEventType.RUN_COMPLETE, {
            runId,
            status: planRun.status,
            stepsCompleted: planRun.steps.filter((s) => s.status === 'completed').length,
            stepsFailed: planRun.steps.filter((s) => s.status === 'failed').length,
        });

        await auditLogger.complete(planRun.status === 'completed' ? 'completed' : 'failed');

        // Hook: after:plan
        if (this.hooks) {
            await this.hooks.dispatch({
                event: 'after:plan',
                name: plan.name,
                result: { success: planRun.status === 'completed' },
                cwd: ctx.cwd,
                runId,
            });
        }

        return planRun;
    }

    /**
     * Create a proposed run (doesn't execute, waits for approval)
     */
    async propose(plan: Plan, _ctx: ExecutionContext): Promise<PlanRun> {
        const runId = generateRunId();
        const auditLogger = new AuditLogger(runId, plan.name);
        await auditLogger.init();

        const planRun: PlanRun = {
            runId,
            planName: plan.name,
            status: 'proposed',
            steps: plan.steps.map((s) => ({
                stepId: s.id,
                status: 'pending' as const,
            })),
            startedAt: new Date().toISOString(),
            triggeredBy: 'propose',
        };

        await auditLogger.save();
        return planRun;
    }
}
