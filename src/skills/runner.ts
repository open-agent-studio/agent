import type { LoadedSkill } from './types.js';
import type { ExecutionContext, ToolResult } from '../tools/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../policy/engine.js';
import { LLMRouter } from '../llm/router.js';
import { runValidators } from './validator.js';
import { auditEmitter, AuditEventType } from '../policy/audit.js';
import { zodToJsonSchema } from '../utils/schema.js';
import type { LLMMessage } from '../llm/types.js';

export interface SkillRunResult {
    success: boolean;
    output?: unknown;
    error?: string;
    toolCalls: { tool: string; input: unknown; result: ToolResult }[];
    validatorResults?: { name: string; passed: boolean; output: string }[];
    durationMs: number;
}

/**
 * Skill runner — executes a loaded skill using its entrypoint
 */
export class SkillRunner {
    private registry: ToolRegistry;
    private policy: PolicyEngine;
    private llmRouter: LLMRouter;

    constructor(registry: ToolRegistry, policy: PolicyEngine, llmRouter: LLMRouter) {
        this.registry = registry;
        this.policy = policy;
        this.llmRouter = llmRouter;
    }

    /**
     * Execute a skill with given inputs
     */
    async run(
        skill: LoadedSkill,
        inputs: Record<string, unknown>,
        ctx: ExecutionContext
    ): Promise<SkillRunResult> {
        const start = Date.now();
        const toolCalls: SkillRunResult['toolCalls'] = [];

        auditEmitter.emit(AuditEventType.SKILL_LOADED, {
            name: skill.manifest.name,
            version: skill.manifest.version,
            entrypoint: skill.manifest.entrypoint,
        });

        try {
            let output: unknown;

            if (skill.promptContent) {
                // Prompt-based skill: send to LLM with tool bindings
                output = await this.runPromptSkill(skill, inputs, ctx, toolCalls);
            } else if (skill.workflowPath) {
                // Workflow-based skill: run the state machine
                output = await this.runWorkflowSkill(skill, inputs, ctx, toolCalls);
            } else {
                throw new Error(`Skill "${skill.manifest.name}" has no valid entrypoint`);
            }

            // Run validators
            const validatorResults = await runValidators(skill, ctx.cwd);
            const allPassed = validatorResults.every((v) => v.passed);

            return {
                success: allPassed || validatorResults.length === 0,
                output,
                toolCalls,
                validatorResults,
                durationMs: Date.now() - start,
            };
        } catch (err) {
            return {
                success: false,
                error: (err as Error).message,
                toolCalls,
                durationMs: Date.now() - start,
            };
        }
    }

    /**
     * Run a prompt-based skill via LLM
     */
    private async runPromptSkill(
        skill: LoadedSkill,
        inputs: Record<string, unknown>,
        ctx: ExecutionContext,
        toolCalls: SkillRunResult['toolCalls']
    ): Promise<unknown> {
        // Build the prompt with inputs
        let prompt = skill.promptContent!;
        for (const [key, value] of Object.entries(inputs)) {
            prompt = prompt.replace(`{{${key}}}`, String(value));
        }

        // Get allowed tools for this skill
        const allowedTools = skill.manifest.tools.includes('*')
            ? this.registry.list().map(m => this.registry.get(m.name)).filter(Boolean)
            : skill.manifest.tools
                .map((name) => this.registry.get(name))
                .filter(Boolean);

        // Send to LLM with tool definitions
        const toolDefs = allowedTools.map((t) => ({
            name: t!.name,
            description: t!.description,
            inputSchema: zodToJsonSchema(t!.inputSchema),
        }));

        // Agentic loop: call LLM, execute tools, repeat
        const messages: LLMMessage[] = [
            { role: 'system', content: prompt },
            { role: 'user', content: `Execute this skill with inputs: ${JSON.stringify(inputs)}` },
        ];

        const maxIterations = 20;
        let lastOutput: unknown = null;

        for (let i = 0; i < maxIterations; i++) {
            const response = await this.llmRouter.chat({
                messages,
                tools: toolDefs,
                skillName: skill.manifest.name,
            });

            if (response.toolCalls && response.toolCalls.length > 0) {
                messages.push({
                    role: 'assistant',
                    content: response.content,
                    toolCalls: response.toolCalls,
                });

                for (const tc of response.toolCalls) {
                    // Check policy
                    const tool = this.registry.get(tc.name);
                    if (!tool) {
                        messages.push({
                            role: 'tool',
                            content: JSON.stringify({ error: `Tool ${tc.name} not found` }),
                            toolCallId: tc.id,
                        });
                        continue;
                    }

                    // Check permissions
                    const permResult = await this.policy.checkPermission(
                        {
                            tool: tc.name,
                            operation: tc.name,
                            description: `Skill "${skill.manifest.name}" calling ${tc.name}`,
                            permissions: tool.permissions,
                            args: tc.args as Record<string, unknown>,
                            riskLevel: 'medium',
                        },
                        ctx
                    );

                    if (!permResult.allowed && permResult.requiresApproval) {
                        const approved = await this.policy.requestApproval(
                            {
                                tool: tc.name,
                                operation: tc.name,
                                description: `Skill "${skill.manifest.name}" calling ${tc.name}`,
                                permissions: tool.permissions,
                                args: tc.args as Record<string, unknown>,
                                riskLevel: 'medium',
                            },
                            ctx
                        );
                        if (!approved) {
                            messages.push({
                                role: 'tool',
                                content: JSON.stringify({ error: 'Permission denied by user' }),
                                toolCallId: tc.id,
                            });
                            continue;
                        }
                    } else if (!permResult.allowed) {
                        messages.push({
                            role: 'tool',
                            content: JSON.stringify({ error: permResult.reason }),
                            toolCallId: tc.id,
                        });
                        continue;
                    }

                    // Execute tool
                    const result = await this.registry.execute(tc.name, tc.args, ctx);
                    toolCalls.push({ tool: tc.name, input: tc.args, result });

                    auditEmitter.emit(AuditEventType.TOOL_CALL, {
                        tool: tc.name,
                        input: tc.args,
                        success: result.success,
                    });

                    messages.push({
                        role: 'tool',
                        content: JSON.stringify(result),
                        toolCallId: tc.id,
                    });
                }
            } else {
                // No tool calls — LLM finished
                lastOutput = response.content;
                break;
            }
        }

        return lastOutput;
    }

    /**
     * Run a workflow-based skill (state machine)
     */
    private async runWorkflowSkill(
        skill: LoadedSkill,
        inputs: Record<string, unknown>,
        ctx: ExecutionContext,
        toolCalls: SkillRunResult['toolCalls']
    ): Promise<unknown> {
        try {
            const module = await import(skill.workflowPath!);
            const workflow = module.default ?? module.run;

            if (typeof workflow !== 'function') {
                throw new Error(`Workflow at ${skill.workflowPath} must export a default function or "run"`);
            }

            // Create a scoped tool executor
            const toolExecutor = async (toolName: string, args: unknown): Promise<ToolResult> => {
                // Ensure tool is in the skill's allowlist
                if (!skill.manifest.tools.includes(toolName)) {
                    return {
                        success: false,
                        error: `Tool "${toolName}" is not allowed for skill "${skill.manifest.name}"`,
                        durationMs: 0,
                    };
                }

                const result = await this.registry.execute(toolName, args, ctx);
                toolCalls.push({ tool: toolName, input: args, result });
                return result;
            };

            return await workflow({ inputs, tools: toolExecutor, context: ctx });
        } catch (err) {
            throw new Error(`Workflow execution failed: ${(err as Error).message}`);
        }
    }
}
