import type { PlanStep, VerifyConfig } from '../plans/types.js';
import type { ExecutionContext } from '../tools/types.js';
import type { StepResult } from './types.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../policy/engine.js';
import { SkillLoader } from '../skills/loader.js';
import { SkillRunner } from '../skills/runner.js';
import { RollbackTracker } from './rollback.js';
import type { HookRegistry } from '../hooks/registry.js';
import { auditEmitter, AuditEventType } from '../policy/audit.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { AgentEvaluator } from './evaluator.js';
import type { LLMRouter } from '../llm/router.js';

const execFileAsync = promisify(execFile);

/**
 * Execution engine — state machine loop for step execution
 *
 * Each step follows:
 * 1. Plan step selection (resolved by caller)
 * 2. Preconditions check
 * 3. Action execution (skill or tool)
 * 4. Verification
 * 5. Retry or fallback
 * 6. Mark complete and proceed
 */
export class ExecutionEngine {
    private registry: ToolRegistry;
    private router: LLMRouter;
    private policy: PolicyEngine;
    private skillLoader: SkillLoader;
    private skillRunner: SkillRunner;
    private rollback: RollbackTracker;
    private hooks?: HookRegistry;
    private evaluator: AgentEvaluator;

    constructor(
        registry: ToolRegistry,
        router: LLMRouter,
        policy: PolicyEngine,
        skillLoader: SkillLoader,
        skillRunner: SkillRunner,
        hooks?: HookRegistry
    ) {
        this.registry = registry;
        this.router = router;
        this.policy = policy;
        this.skillLoader = skillLoader;
        this.skillRunner = skillRunner;
        this.rollback = new RollbackTracker();
        this.hooks = hooks;
        this.evaluator = new AgentEvaluator(this.router);
    }

    /**
     * Execute a single plan step
     */
    async executeStep(step: PlanStep, ctx: ExecutionContext): Promise<StepResult> {
        const start = Date.now();

        try {
            // Phase 1: Preconditions check
            if (step.dependsOn && step.dependsOn.length > 0) {
                // Dependencies are checked by PlanRunner before calling this
            }

            let result: StepResult;

            if (step.skill) {
                // Execute via skill
                result = await this.executeSkillStep(step, ctx);
            } else if (step.tool) {
                // Execute via direct tool call
                result = await this.executeToolStep(step, ctx);
            } else {
                result = {
                    success: false,
                    error: `Step "${step.id}" has neither skill nor tool defined`,
                    durationMs: Date.now() - start,
                };
            }

            // Phase 4: Self-Reflection / Evaluation
            // If the tool didn't crash outright, let the critic grade the semantic outcome
            if (result.success && (step.skill || step.tool)) {
                try {
                    const evalResult = await this.evaluator.evaluateStep(step, result);
                    if (!evalResult.success) {
                        result.success = false;
                        result.error = `Critic Evaluation Failed (Confidence: ${evalResult.confidence}/10): ${evalResult.feedback}`;
                    } else if (evalResult.feedback) {
                        // Attach positive feedback to output for context
                        result.output = `${result.output ? JSON.stringify(result.output) + '\n' : ''}[Critic: ${evalResult.feedback}]`;
                    }
                } catch (evalErr) {
                    console.warn('[ExecutionEngine] Evaluator failed, continuing with raw tool result', evalErr);
                }
            }

            return { ...result, durationMs: Date.now() - start };
        } catch (err) {
            return {
                success: false,
                error: (err as Error).message,
                durationMs: Date.now() - start,
            };
        }
    }

    /**
     * Execute a step via a skill
     */
    private async executeSkillStep(step: PlanStep, ctx: ExecutionContext): Promise<StepResult> {
        const skill = this.skillLoader.get(step.skill!);
        if (!skill) {
            return { success: false, error: `Skill "${step.skill}" not found`, durationMs: 0 };
        }

        const result = await this.skillRunner.run(skill, step.args ?? {}, ctx);

        return {
            success: result.success,
            output: result.output,
            error: result.error,
            toolCalls: result.toolCalls,
            durationMs: result.durationMs,
        };
    }

    /**
     * Execute a step via a direct tool call
     */
    private async executeToolStep(step: PlanStep, ctx: ExecutionContext): Promise<StepResult> {
        const tool = this.registry.get(step.tool!);
        if (!tool) {
            return { success: false, error: `Tool "${step.tool}" not found`, durationMs: 0 };
        }

        // Check permissions
        const permResult = await this.policy.checkPermission(
            {
                tool: step.tool!,
                operation: step.tool!,
                description: `Plan step "${step.name}" calling ${step.tool}`,
                permissions: tool.permissions,
                args: step.args,
                riskLevel: 'medium',
            },
            ctx
        );

        if (!permResult.allowed && permResult.requiresApproval) {
            const approved = await this.policy.requestApproval(
                {
                    tool: step.tool!,
                    operation: step.tool!,
                    description: `Plan step "${step.name}" calling ${step.tool}`,
                    permissions: tool.permissions,
                    args: step.args,
                    riskLevel: 'medium',
                },
                ctx
            );
            if (!approved) {
                return { success: false, error: 'Permission denied by user', durationMs: 0 };
            }
        } else if (!permResult.allowed) {
            return { success: false, error: permResult.reason, durationMs: 0 };
        }

        // Track file state for rollback (if filesystem write)
        if (step.tool!.startsWith('fs.') && step.args?.['path']) {
            await this.rollback.captureBeforeState(
                step.id,
                step.args['path'] as string,
                ctx.cwd
            );
        }

        // Hook: before:tool
        if (this.hooks) {
            await this.hooks.dispatch({
                event: 'before:tool',
                name: step.tool!,
                args: step.args,
                cwd: ctx.cwd,
                runId: ctx.runId,
            });
        }

        const result = await this.registry.execute(step.tool!, step.args, ctx);

        // Hook: after:tool
        if (this.hooks) {
            await this.hooks.dispatch({
                event: 'after:tool',
                name: step.tool!,
                args: step.args,
                result: { success: result.success, output: result.data, error: result.error },
                cwd: ctx.cwd,
                runId: ctx.runId,
            });
        }

        auditEmitter.emit(AuditEventType.TOOL_CALL, {
            stepId: step.id,
            tool: step.tool,
            input: step.args,
            success: result.success,
        });

        // Capture after state for rollback
        if (step.tool!.startsWith('fs.') && step.args?.['path'] && result.success) {
            await this.rollback.captureAfterState(
                step.id,
                step.args['path'] as string,
                ctx.cwd
            );
        }

        return {
            success: result.success,
            output: result.data,
            error: result.error,
            durationMs: result.durationMs,
        };
    }

    /**
     * Run verification for a step
     */
    async verify(verifyConfig: VerifyConfig, ctx: ExecutionContext): Promise<{ passed: boolean; details: string }> {
        const results: string[] = [];
        let passed = true;

        // Check command exit code
        if (verifyConfig.command) {
            try {
                const { stdout } = await execFileAsync(
                    verifyConfig.command.split(' ')[0],
                    verifyConfig.command.split(' ').slice(1),
                    { cwd: ctx.cwd, timeout: 30000, shell: true }
                );
                const output = stdout.toString();

                if (verifyConfig.exitCode !== undefined) {
                    // Exit code check is implicit (execFile throws on non-zero)
                    results.push(`Command exited with code 0 (expected: ${verifyConfig.exitCode})`);
                }

                if (verifyConfig.contains && !output.includes(verifyConfig.contains)) {
                    passed = false;
                    results.push(`Output does not contain "${verifyConfig.contains}"`);
                } else if (verifyConfig.contains) {
                    results.push(`Output contains "${verifyConfig.contains}"`);
                }

                results.push('Command executed successfully');
            } catch (err) {
                passed = false;
                results.push(`Command failed: ${(err as Error).message}`);
            }
        }

        // Check file existence
        if (verifyConfig.fileExists) {
            try {
                const filePath = require('node:path').resolve(ctx.cwd, verifyConfig.fileExists);
                await access(filePath);
                results.push(`File exists: ${verifyConfig.fileExists}`);
            } catch {
                passed = false;
                results.push(`File not found: ${verifyConfig.fileExists}`);
            }
        }

        return { passed, details: results.join('\n') };
    }

    /**
     * Get the rollback tracker
     */
    getRollbackTracker(): RollbackTracker {
        return this.rollback;
    }
}
