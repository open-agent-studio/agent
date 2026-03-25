import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigLoader } from '../../config/loader.js';
import { ToolRegistry } from '../../tools/registry.js';
import { PolicyEngine } from '../../policy/engine.js';
import { SkillLoader } from '../../skills/loader.js';
import { SkillRunner } from '../../skills/runner.js';
import { LLMRouter } from '../../llm/router.js';
import { CommandLoader } from '../../commands/loader.js';
import { ScriptLoader } from '../../scripts/loader.js';
import { ScriptRunner } from '../../scripts/runner.js';
import { SessionStore } from '../../session/session-store.js';
import { registerCoreTools } from './init.js';
import { ConversationManager } from '../conversation.js';
import { promptApproval } from '../ui/prompt.js';
import { progress } from '../ui/progress.js';
import { generateRunId } from '../../utils/paths.js';
import { zodToJsonSchema } from '../../utils/schema.js';
import type { ExecutionContext } from '../../tools/types.js';
import type { LLMMessage } from '../../llm/types.js';

export function createRunCommand(): Command {
    const cmd = new Command('run')
        .description('Run a goal or task')
        .argument('<goal>', 'Goal description or task to run')
        .option('-s, --skill <skillName>', 'Use a specific skill')
        .option('-a, --autonomous', 'Run in autonomous mode (auto-approve low-risk actions)')
        .option('--dry-run', 'Show what would be done without executing')
        .option('--remote <url>', 'Run the agent remotely on a daemon/cloud server (e.g. http://localhost:3333)')
        .option('--remote-key <key>', 'API key for the remote Agent Studio instance')
        .option('-r, --role <role>', 'Run the agent using a specific persona (e.g. planner, coder, operator)')
        .option('--session <id>', 'Resume an existing session by ID')
        .option('--session-name <name>', 'Assign a name to the new session')
        .action(async (goal: string, options: { skill?: string; role?: string; autonomous?: boolean; dryRun?: boolean; remote?: string; remoteKey?: string; session?: string; sessionName?: string }) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            // ─── Remote Execution Mode ───
            if (options.remote) {
                progress.start(`Connecting to remote agent: ${options.remote}`, 1);
                progress.step('Sending goal to daemon...');

                try {
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (options.remoteKey) {
                        headers['Authorization'] = `Bearer ${options.remoteKey}`;
                    }

                    const response = await fetch(`${options.remote.replace(/\/$/, '')}/api/execute`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ goal })
                    });

                    if (!response.ok) {
                        const err = await response.json().catch(() => ({})) as any;
                        throw new Error(err.error || `HTTP ${response.status} ${response.statusText}`);
                    }

                    if (!response.body) throw new Error('No response body from remote server');

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        let newlineIndex;
                        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
                            const chunk = buffer.slice(0, newlineIndex);
                            buffer = buffer.slice(newlineIndex + 2);

                            const lines = chunk.split('\n');
                            const eventLine = lines.find(l => l.startsWith('event:'));
                            const dataLine = lines.find(l => l.startsWith('data:'));

                            if (eventLine && dataLine) {
                                const eventType = eventLine.replace('event: ', '').trim();
                                const dataStr = dataLine.replace('data: ', '').trim();

                                try {
                                    const parsed = JSON.parse(dataStr);
                                    if (eventType === 'progress') {
                                        progress.info(parsed.message);
                                    } else if (eventType === 'success') {
                                        progress.info(chalk.green(parsed.message));
                                    } else if (eventType === 'warning') {
                                        progress.warning(parsed.message);
                                    } else if (eventType === 'error') {
                                        progress.error(parsed.message);
                                        process.exit(1);
                                    } else if (eventType === 'done') {
                                        progress.success('Remote goal completed');
                                        console.log(chalk.dim('\nResult:'));
                                        console.log(parsed.result);
                                        process.exit(0);
                                    }
                                } catch (e) {
                                    // ignore parse errors for chunks
                                }
                            }
                        }
                    }
                    progress.success('Remote execution connection closed');
                    process.exit(0);
                } catch (err) {
                    progress.error(`Remote execution failed: ${(err as Error).message}`);
                    process.exit(1);
                }
                // ─── Local Execution Mode ───
                return;
            }

            const sessionStore = new SessionStore(process.cwd());
            let conversation: ConversationManager;

            const plannerPrompt = `You are an autonomous AI agent that accomplishes tasks using available tools.
Keep responses concise and actionable. When the task is complete, use a final message to summarize what you did.`;

            if (options.session) {
                const loaded = ConversationManager.load(sessionStore, options.session);
                if (!loaded) {
                    console.error(chalk.red(`✗ Session '${options.session}' not found.`));
                    process.exit(1);
                }
                conversation = loaded;
                conversation.addUser(goal); // append the new goal
            } else {
                conversation = new ConversationManager(plannerPrompt, sessionStore, undefined, options.sessionName);
                conversation.addUser(goal);
            }

            const registry = ToolRegistry.getInstance();
            registerCoreTools(registry);

            const policy = new PolicyEngine(config, process.cwd());
            const skillLoader = new SkillLoader(config);
            const llmRouter = new LLMRouter(config);
            const skillRunner = new SkillRunner(registry, policy, llmRouter);
            const commandLoader = new CommandLoader();
            const scriptLoader = new ScriptLoader();


            await skillLoader.loadAll();
            await commandLoader.loadProjectCommands(process.cwd());

            const scriptInstallPaths = config.scripts?.installPaths ?? ['.agent/scripts'];
            await scriptLoader.loadAll(scriptInstallPaths, process.cwd());

            const { PluginLoader } = await import('../../plugins/loader.js');
            const { HookRegistry } = await import('../../hooks/registry.js');
            const pluginLoader = new PluginLoader();
            const hookRegistry = new HookRegistry();

            const installPaths = config.plugins?.installPaths ?? ['.agent/plugins'];
            await pluginLoader.loadAll(installPaths, process.cwd(), skillLoader, commandLoader, hookRegistry, scriptLoader);

            const ctx: ExecutionContext = {
                runId: generateRunId(),
                cwd: process.cwd(),
                config,
                autonomous: options.autonomous ?? false,
                dryRun: options.dryRun ?? false,
                approvedPermissions: new Set(),
                onApproval: promptApproval,
                onProgress: (msg) => progress.info(msg),
            };

            if (options.skill) {
                // Run a specific skill
                const skill = skillLoader.get(options.skill);
                if (!skill) {
                    console.error(chalk.red(`Skill "${options.skill}" not found`));
                    console.log(chalk.dim('\nAvailable skills:'));
                    for (const s of skillLoader.list()) {
                        console.log(chalk.dim(`  - ${s.manifest.name}`));
                    }
                    process.exit(1);
                }

                progress.start(`Running skill: ${skill.manifest.name}`, 1);
                progress.step(skill.manifest.description);

                const result = await skillRunner.run(skill, { goal }, ctx);

                if (result.success) {
                    progress.success('Skill completed successfully');
                    if (result.output) {
                        console.log(chalk.dim('\nOutput:'));
                        console.log(typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2));
                    }
                } else {
                    progress.error(`Skill failed: ${result.error}`);
                    process.exit(1);
                }
            } else if (commandLoader.has(goal) || commandLoader.has(goal.replace(/^\//, ''))) {
                // ─── Run a Command (lightweight goal template) ───
                const cmdName = goal.replace(/^\//, '');
                const command = commandLoader.get(cmdName)!;

                progress.start(`Running command: ${command.name}`, 1);
                progress.step(command.description);

                try {
                    // Scope tools to what the command allows
                    const allTools = registry.list();
                    const allowedTools = command.tools.length > 0
                        ? allTools.filter((t) => command.tools.some((pattern) => {
                            if (pattern === t.name) return true;
                            if (pattern.endsWith('.*')) return t.name.startsWith(pattern.slice(0, -1));
                            return false;
                        }))
                        : allTools;

                    const toolDefs = allowedTools.map((t) => {
                        const fullTool = registry.get(t.name);
                        return {
                            name: t.name,
                            description: t.description,
                            inputSchema: fullTool ? zodToJsonSchema(fullTool.inputSchema) : {},
                        };
                    });

                    const messages: LLMMessage[] = [
                        { role: 'system', content: command.prompt },
                        { role: 'user', content: `Execute this command. Additional context: ${goal}` },
                    ];

                    const maxIterations = 20;
                    let finalOutput = '';

                    for (let i = 0; i < maxIterations; i++) {
                        const response = await llmRouter.chat({ messages, tools: toolDefs });

                        if (response.toolCalls && response.toolCalls.length > 0) {
                            messages.push({
                                role: 'assistant',
                                content: response.content || '',
                                toolCalls: response.toolCalls,
                            });

                            for (const tc of response.toolCalls) {
                                const tool = registry.get(tc.name);
                                if (!tool) {
                                    messages.push({ role: 'tool', content: JSON.stringify({ error: `Tool ${tc.name} not found` }), toolCallId: tc.id });
                                    continue;
                                }

                                progress.info(`⚡ ${tc.name}(${JSON.stringify(tc.args).substring(0, 80)})`);
                                const result = await registry.execute(tc.name, tc.args, ctx);

                                if (result.success) {
                                    progress.info(`  ✓ ${tc.name} succeeded`);
                                } else {
                                    progress.warning(`  ✗ ${tc.name}: ${result.error}`);
                                }

                                messages.push({ role: 'tool', content: JSON.stringify(result.data ?? { error: result.error }), toolCallId: tc.id });
                            }
                        } else {
                            finalOutput = response.content;
                            break;
                        }
                    }

                    progress.success('Command completed');
                    console.log(chalk.dim('\nResult:'));
                    console.log(finalOutput);
                } catch (err) {
                    progress.error(`Failed: ${(err as Error).message}`);
                    process.exit(1);
                }
            } else if (scriptLoader.has(goal) || scriptLoader.has(goal.replace(/^\//, ''))) {
                // ─── Run a Script (direct execution, no LLM) ───
                const scriptName = goal.replace(/^\//, '');
                const script = scriptLoader.get(scriptName)!;

                progress.start(`Running script: ${script.manifest.name}`, 1);
                progress.step(script.manifest.description);

                const scriptRunner = new ScriptRunner();
                const result = await scriptRunner.run(script, {}, {
                    projectRoot: process.cwd(),
                });

                if (result.success) {
                    progress.success(`Script completed successfully (${result.durationMs}ms)`);
                } else {
                    progress.error(`Script failed with exit code ${result.exitCode}`);
                    process.exit(result.exitCode);
                }
            } else {
                // Run goal via LLM with agentic tool-use loop
                progress.start(`Running goal: ${goal}`, 1);
                progress.step('Sending to LLM...');

                try {
                    const allTools = registry.list();
                    const toolDefs = allTools.map((t) => {
                        const fullTool = registry.get(t.name);
                        return {
                            name: t.name,
                            description: t.description,
                            inputSchema: fullTool ? zodToJsonSchema(fullTool.inputSchema) : {},
                        };
                    });

                    const messages: LLMMessage[] = [
                        {
                            role: 'system',
                            content: `You are an agent that accomplishes tasks using available tools.
You have access to the following tools: ${toolDefs.map(t => t.name).join(', ')}.

Available Skills:
${skillLoader.list().map(s => `- ${s.manifest.name}: ${s.manifest.description}`).join('\n')}

Available Scripts (run via cmd.run tool with "agent scripts run <name>"):
${scriptLoader.list().map(s => `- ${s.manifest.name}: ${s.manifest.description}`).join('\n') || '(none)'}

INSTRUCTIONS:
1. Use available tools to complete the user's goal step by step.
2. If the user asks for a task covered by a skill (like opening VS Code), you can execute the underlying tool (e.g. cmd.run) to achieve it.
3. If there is a script that matches the user's request, run it using cmd.run with "agent scripts run <script-name>".
4. Be proactive: if the user wants an action (open app, create file), DO IT. Do not just explain how.
5. When done, provide a final summary.`,
                        },
                        { role: 'user', content: goal },
                    ];

                    const maxIterations = 20;
                    let finalOutput = '';

                    for (let i = 0; i < maxIterations; i++) {
                        const response = await llmRouter.chat({
                            messages,
                            tools: toolDefs,
                        });

                        if (response.toolCalls && response.toolCalls.length > 0) {
                            // Push assistant message with tool calls
                            messages.push({
                                role: 'assistant',
                                content: response.content || '',
                                toolCalls: response.toolCalls,
                            });

                            for (const tc of response.toolCalls) {
                                const tool = registry.get(tc.name);
                                if (!tool) {
                                    progress.warning(`Tool "${tc.name}" not found, skipping`);
                                    messages.push({
                                        role: 'tool',
                                        content: JSON.stringify({ error: `Tool ${tc.name} not found` }),
                                        toolCallId: tc.id,
                                    });
                                    continue;
                                }

                                // Check policy
                                const permResult = await policy.checkPermission(
                                    {
                                        tool: tc.name,
                                        operation: tc.name,
                                        description: `Goal "${goal}" calling ${tc.name}`,
                                        permissions: tool.permissions,
                                        args: tc.args as Record<string, unknown>,
                                        riskLevel: 'medium',
                                    },
                                    ctx
                                );

                                if (!permResult.allowed && permResult.requiresApproval) {
                                    const approved = await policy.requestApproval(
                                        {
                                            tool: tc.name,
                                            operation: tc.name,
                                            description: `Goal "${goal}" calling ${tc.name}`,
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
                                progress.info(`⚡ ${tc.name}(${JSON.stringify(tc.args).substring(0, 80)})`);
                                const result = await registry.execute(tc.name, tc.args, ctx);

                                if (result.success) {
                                    progress.info(`  ✓ ${tc.name} succeeded`);
                                } else {
                                    progress.warning(`  ✗ ${tc.name}: ${result.error}`);
                                }

                                messages.push({
                                    role: 'tool',
                                    content: JSON.stringify(result.data ?? { error: result.error }),
                                    toolCallId: tc.id,
                                });
                            }
                        } else {
                            // No tool calls — LLM finished
                            finalOutput = response.content;
                            break;
                        }
                    }

                    progress.success('Goal completed');
                    console.log(chalk.dim('\nResult:'));
                    console.log(finalOutput);
                } catch (err) {
                    progress.error(`Failed: ${(err as Error).message}`);
                    process.exit(1);
                }
            }
        });

    return cmd;
}
