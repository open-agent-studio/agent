import type { AgentConfig } from '../config/schema.js';
import { ToolRegistry } from '../tools/registry.js';
import { SkillLoader } from '../skills/loader.js';
import { PlanParser } from '../plans/parser.js';
import { PlanRunner } from '../plans/runner.js';
import { ExecutionEngine } from '../engine/executor.js';
import { PolicyEngine } from '../policy/engine.js';
import { SkillRunner } from '../skills/runner.js';
import { LLMRouter } from '../llm/router.js';
import { registerCoreTools } from '../cli/commands/init.js';
import { generateRunId } from '../utils/paths.js';
import type { ExecutionContext } from '../tools/types.js';
import { zodToJsonSchema } from '../utils/schema.js';

interface McpToolDef {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

/**
 * MCP tool handlers — wraps agent capabilities for MCP exposure
 */
export async function createMcpHandlers(config: AgentConfig) {
    // Initialize runtime components
    const registry = ToolRegistry.getInstance();
    registerCoreTools(registry);

    const policy = new PolicyEngine(config, process.cwd());
    const skillLoader = new SkillLoader(config);
    const llmRouter = new LLMRouter(config);
    const skillRunner = new SkillRunner(registry, policy, llmRouter);
    const engine = new ExecutionEngine(registry, llmRouter, policy, skillLoader, skillRunner);
    const planParser = new PlanParser();
    const planRunner = new PlanRunner(engine, llmRouter);

    await skillLoader.loadAll();

    const createContext = (): ExecutionContext => ({
        runId: generateRunId(),
        cwd: process.cwd(),
        config,
        autonomous: false,
        approvedPermissions: new Set(),
    });

    return {
        getToolDefinitions(): McpToolDef[] {
            const tools: McpToolDef[] = [
                {
                    name: 'skills_list',
                    description: 'List all available skills',
                    inputSchema: { type: 'object', properties: {} },
                },
                {
                    name: 'skills_run',
                    description: 'Run a skill with given inputs',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Skill name' },
                            inputs: { type: 'object', description: 'Skill inputs' },
                        },
                        required: ['name'],
                    },
                },
                {
                    name: 'plans_list',
                    description: 'List all available plans',
                    inputSchema: { type: 'object', properties: {} },
                },
                {
                    name: 'plans_propose',
                    description: 'Create a proposed plan run for review',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Plan name' },
                        },
                        required: ['name'],
                    },
                },
                {
                    name: 'plans_run',
                    description: 'Execute a plan',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Plan name' },
                        },
                        required: ['name'],
                    },
                },
            ];

            // Add gated tools from config
            for (const toolName of config.mcp.gatedTools) {
                const tool = registry.get(toolName);
                if (tool) {
                    tools.push({
                        name: toolName.replace(/\./g, '_'),
                        description: tool.description,
                        inputSchema: zodToJsonSchema(tool.inputSchema) as Record<string, unknown>,
                    });
                }
            }

            return tools;
        },

        async handleToolCall(
            name: string,
            args: Record<string, unknown>
        ): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
            const ctx = createContext();

            try {
                switch (name) {
                    case 'skills_list': {
                        const skills = skillLoader.list().map((s) => ({
                            name: s.manifest.name,
                            version: s.manifest.version,
                            description: s.manifest.description,
                            state: s.manifest.state,
                        }));
                        return { content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }] };
                    }

                    case 'skills_run': {
                        const skill = skillLoader.get(args['name'] as string);
                        if (!skill) {
                            return { content: [{ type: 'text', text: `Skill "${args['name']}" not found` }], isError: true };
                        }
                        const result = await skillRunner.run(skill, (args['inputs'] as Record<string, unknown>) ?? {}, ctx);
                        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                    }

                    case 'plans_list': {
                        const plans = await planParser.listPlans();
                        return { content: [{ type: 'text', text: JSON.stringify(plans, null, 2) }] };
                    }

                    case 'plans_propose': {
                        const plan = await planParser.findPlan(args['name'] as string);
                        if (!plan) {
                            return { content: [{ type: 'text', text: `Plan "${args['name']}" not found` }], isError: true };
                        }
                        const run = await planRunner.propose(plan, ctx);
                        return { content: [{ type: 'text', text: JSON.stringify(run, null, 2) }] };
                    }

                    case 'plans_run': {
                        const plan = await planParser.findPlan(args['name'] as string);
                        if (!plan) {
                            return { content: [{ type: 'text', text: `Plan "${args['name']}" not found` }], isError: true };
                        }
                        const run = await planRunner.run(plan, ctx);
                        return { content: [{ type: 'text', text: JSON.stringify(run, null, 2) }] };
                    }

                    default: {
                        // Try as a gated tool (fs_read → fs.read)
                        const toolName = name.replace(/_/g, '.');
                        if (registry.has(toolName)) {
                            const result = await registry.execute(toolName, args, ctx);
                            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                        }
                        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
                    }
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
                    isError: true,
                };
            }
        },
    };
}
