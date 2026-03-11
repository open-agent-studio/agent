import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { ConfigLoader } from '../config/loader.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../policy/engine.js';
import { SkillLoader } from '../skills/loader.js';
import { LLMRouter } from '../llm/router.js';
import { CommandLoader } from '../commands/loader.js';
import { HookRegistry } from '../hooks/registry.js';
import { ScriptLoader } from '../scripts/loader.js';
import { registerCoreTools } from './commands/init.js';
import { promptApproval } from './ui/prompt.js';
import { renderBanner, renderToolCall, renderSummary, renderError } from './ui/render.js';
import { Spinner } from './ui/spinner.js';
import { ConversationManager } from './conversation.js';
import { SlashCommandRegistry } from './slash-commands.js';
import { zodToJsonSchema } from '../utils/schema.js';
import { generateRunId } from '../utils/paths.js';
import { InstanceRegistry } from '../instance/registry.js';
import type { ExecutionContext } from '../tools/types.js';
import { io, type Socket } from 'socket.io-client';
import { checkForUpdates } from './updater.js';
import { getAgentVersion } from '../utils/version.js';
import { EpisodicMemory } from '../memory/episodic.js';
import { getRunsDir } from '../utils/paths.js';
import { SessionStore } from '../session/session-store.js';

/**
 * Interactive REPL — the heart of the Claude Code-style experience
 *
 * Launched when the user types `agent` with no arguments.
 * Provides a conversational loop with slash commands, tool execution,
 * and persistent conversation context.
 */
export async function startREPL(): Promise<void> {
    // ─── Bootstrap all subsystems ───
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();

    const registry = ToolRegistry.getInstance();
    registerCoreTools(registry);

    const policy = new PolicyEngine(config, process.cwd());
    const skillLoader = new SkillLoader(config);
    const llmRouter = new LLMRouter(config);
    const commandLoader = new CommandLoader();
    const hookRegistry = new HookRegistry();
    const scriptLoader = new ScriptLoader();

    await skillLoader.loadAll();
    await commandLoader.loadProjectCommands(process.cwd());
    await hookRegistry.loadProjectHooks(process.cwd());

    const scriptInstallPaths = config.scripts?.installPaths ?? ['.agent/scripts'];
    await scriptLoader.loadAll(scriptInstallPaths, process.cwd());

    // ─── Detect project name ───
    let projectName: string | undefined;
    try {
        const pkg = await import('node:fs/promises').then(fs =>
            fs.readFile('package.json', 'utf-8').then(JSON.parse)
        );
        projectName = pkg.name;
    } catch { /* not a node project */ }

    // ─── Register with Global InstanceRegistry ───
    const instanceRegistry = new InstanceRegistry();
    const instanceId = `repl-${Date.now()}`;
    await instanceRegistry.register({
        id: instanceId,
        pid: process.pid,
        cwd: process.cwd(),
        port: 0,
        status: 'idle',
        project: projectName
    });

    // ─── Show welcome banner ───
    const defaultProvider = config.models.routing.defaultProvider;
    const providerConfig = config.models.providers[defaultProvider];
    const modelName = providerConfig?.model ?? defaultProvider;

    const currentVersion = getAgentVersion();

    renderBanner(config, {
        version: currentVersion,
        project: projectName,
        skillCount: skillLoader.list().length,
        commandCount: commandLoader.list().length,
        scriptCount: scriptLoader.list().length,
        provider: modelName,
    });

    // ─── Auto-update check (non-blocking) ───
    await checkForUpdates(currentVersion);

    // ─── Prepare tool definitions for LLM ───
    const allTools = registry.list();
    const toolDefs = allTools.map((t) => {
        const fullTool = registry.get(t.name);
        return {
            name: t.name,
            description: t.description,
            inputSchema: fullTool ? zodToJsonSchema(fullTool.inputSchema) : {},
        };
    });

    // ─── Build system prompt ───
    const systemPrompt = `You are an autonomous AI agent that accomplishes tasks using available tools.
You have access to the following tools: ${toolDefs.map(t => t.name).join(', ')}.

Available Skills:
${skillLoader.list().map(s => `- ${s.manifest.name}: ${s.manifest.description}`).join('\n')}

Available Commands:
${commandLoader.list().map(c => `- ${c.name}: ${c.description}`).join('\n')}

Available Scripts (run via cmd.run tool with "agent scripts run <name>"):
${scriptLoader.list().map(s => `- ${s.manifest.name}: ${s.manifest.description}`).join('\n') || '(none)'}

INSTRUCTIONS:
1. Use available tools to complete the user's goal step by step.
2. Be proactive: if the user wants an action (open app, create file, refactor code), DO IT with tools.
3. If there is a script that matches the user's request, run it using cmd.run with "agent scripts run <script-name>".
4. Keep responses concise and actionable.
5. When done, provide a clear summary of what was accomplished.
6. If the user asks a question that doesn't require tool use, just answer directly.`;

    // ─── Initialize conversation and slash commands ───
    const sessionStore = new SessionStore(process.cwd());
    let conversation: ConversationManager;

    if (process.env.AGENT_RESUME_SESSION) {
        const loaded = ConversationManager.load(sessionStore, process.env.AGENT_RESUME_SESSION);
        if (loaded) {
            conversation = loaded;
            console.log(chalk.dim(`\n  [Restored previous session with ${conversation.turns} turns]\n`));
        } else {
            conversation = new ConversationManager(systemPrompt, sessionStore);
            console.log(chalk.yellow(`\n  [Warning: Session '${process.env.AGENT_RESUME_SESSION}' not found, starting new session]\n`));
        }
    } else {
        conversation = new ConversationManager(systemPrompt, sessionStore);
    }

    const slashCommands = new SlashCommandRegistry();
    const slashCtx = { config, skillLoader, commandLoader, hookRegistry, llmRouter, scriptLoader };
    const spinner = new Spinner();

    // ─── Bind Socket to Agent Studio ───
    const socket: Socket = io('http://localhost:3333', { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
        socket.emit('subscribe', instanceId);
    });
    let activeRemoteCmd = false;

    socket.on('agent:command', async (data: { instanceId: string, command: string }) => {
        if (data.instanceId !== instanceId) return;

        activeRemoteCmd = true;
        socket.emit('agent:log', { instanceId, text: `Executing remote command: ${data.command}`, type: 'system' });
        try {
            await executeGoal(undefined, data.command, [], {
                conversation, llmRouter, registry, policy, toolDefs, ctx, spinner, rl, socket, instanceId
            });
            socket.emit('agent:log', { instanceId, text: `Command completed: ${data.command}`, type: 'result' });
        } catch (e) {
            socket.emit('agent:log', { instanceId, text: `Error: ${(e as Error).message}`, type: 'error' });
        } finally {
            activeRemoteCmd = false;
        }
    });

    const ctx: ExecutionContext = {
        runId: generateRunId(),
        cwd: process.cwd(),
        config,
        autonomous: false,
        dryRun: false,
        approvedPermissions: new Set(),
        onApproval: async (action) => {
            if (activeRemoteCmd) {
                return new Promise((resolve) => {
                    socket.emit('agent:approval:request', { instanceId, action });
                    socket.once(`agent:approval:response:${action.tool}`, (data: { approved: boolean }) => {
                        resolve(data.approved);
                    });
                });
            } else {
                return await promptApproval(action);
            }
        },
        onProgress: (msg) => {
            if (spinner.isSpinning) spinner.update(msg);
            socket.emit('agent:log', { instanceId, text: msg, type: 'info' });
        },
    };

    // ─── REPL Loop ───
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('  > '),
        terminal: true,
        completer: (line: string) => {
            // Tab completion for slash commands
            if (line.startsWith('/')) {
                const prefix = line.slice(1);
                const builtins = slashCommands.list().map(c => `/${c.name}`);
                const userCmds = commandLoader.list().map(c => `/${c.name}`);
                const all = [...builtins, ...userCmds];
                const hits = all.filter(c => c.startsWith(`/${prefix}`));
                return [hits.length ? hits : all, line];
            }
            return [[], line];
        },
    });

    rl.prompt();

    let isExecuting = false;

    rl.on('line', async (input) => {
        if (isExecuting) return;

        const trimmed = input.trim();

        if (!trimmed) {
            rl.prompt();
            return;
        }

        try {
            isExecuting = true;
            rl.pause();
            // ─── Slash Command? ───
            if (trimmed.startsWith('/')) {
                const parts = trimmed.slice(1).split(' ');
                const cmdName = parts[0];
                const cmdArgs = parts.slice(1).join(' ');

                // Built-in slash command
                if (slashCommands.has(cmdName)) {
                    await slashCommands.get(cmdName)!.execute(cmdArgs, slashCtx);
                    isExecuting = false;
                    rl.resume();
                    rl.prompt();
                    return;
                }

                // User-defined command
                if (commandLoader.has(cmdName)) {
                    const command = commandLoader.get(cmdName)!;
                    console.log(chalk.dim(`\n  Running command: ${command.name}...`));
                    await executeGoal(command.prompt, `Execute: ${cmdArgs || command.description}`, command.tools, {
                        conversation, llmRouter, registry, policy, toolDefs, ctx, spinner, rl,
                    });
                    isExecuting = false;
                    rl.resume();
                    return;
                }

                console.log(chalk.red(`  Unknown command: /${cmdName}`));
                console.log(chalk.dim(`  Type /help for available commands.`));
                isExecuting = false;
                rl.resume();
                rl.prompt();
                return;
            }

            // ─── /compact ───
            if (trimmed === '/compact') {
                conversation.compact();
            }

            // ─── Natural language goal ───
            console.log();
            await executeGoal(undefined, trimmed, [], {
                conversation, llmRouter, registry, policy, toolDefs, ctx, spinner, rl,
            });
        } catch (err) {
            renderError((err as Error).message);
            rl.prompt();
        } finally {
            isExecuting = false;
            rl.resume();
        }
    });

    rl.on('close', async () => {
        console.log(chalk.dim('\n  👋 Goodbye!\n'));
        await instanceRegistry.unregister(instanceId);
        process.exit(0);
    });

    // Handle abrupt exits
    process.on('SIGINT', async () => {
        await instanceRegistry.unregister(instanceId);
        process.exit(0);
    });
}

// ─── Execute a goal through the LLM loop ───

interface ExecDeps {
    conversation: ConversationManager;
    llmRouter: LLMRouter;
    registry: ToolRegistry;
    policy: PolicyEngine;
    toolDefs: { name: string; description: string; inputSchema: unknown }[];
    ctx: ExecutionContext;
    spinner: Spinner;
    rl: ReturnType<typeof createInterface>;
    socket?: Socket;
    instanceId?: string;
}

async function executeGoal(
    systemOverride: string | undefined,
    userMessage: string,
    scopedTools: string[],
    deps: ExecDeps
): Promise<void> {
    const { conversation, llmRouter, registry, policy, ctx, spinner, rl } = deps;
    const start = Date.now();

    // Scope tools if command specifies them
    let activeDefs = deps.toolDefs;
    if (scopedTools.length > 0) {
        activeDefs = deps.toolDefs.filter(t =>
            scopedTools.some(pattern => {
                if (pattern === t.name) return true;
                if (pattern.endsWith('.*')) return t.name.startsWith(pattern.slice(0, -1));
                return false;
            })
        );
    }

    // ─── Episodic Memory Retrieval ───
    let memoryContext = '';
    try {
        const memoryDir = getRunsDir();
        const memory = EpisodicMemory.open(memoryDir);

        // Suppress missing provider errors if embeddings aren't configured
        const userEmbedding = await llmRouter.generateEmbedding(userMessage).catch(() => null);

        if (userEmbedding) {
            const similar = memory.searchSimilar(userEmbedding, 3);
            if (similar.length > 0) {
                memoryContext = '\n\n### RELEVANT PAST EXPERIENCES (EPISODIC MEMORY) ###\n' +
                    'The following are successful executions of similar tasks from the past. ' +
                    'Analyze their tool usage and apply the same patterns if applicable:\n' +
                    similar.map(s => `- Intent: ${s.episode.intent}\n  Execution History:\n  ${s.episode.execution_history}`).join('\n\n');
            }
        }
        memory.close();
    } catch (e) {
        // Soft fail if memory isn't available
    }

    // Add user message to conversation
    conversation.addUser(userMessage);

    const mergedSystem = (systemOverride || '') + memoryContext;

    const messages = mergedSystem
        ? [{ role: 'system' as const, content: mergedSystem }, ...conversation.getMessages().slice(1)]
        : conversation.getMessages();

    spinner.start('Thinking...');

    const maxIterations = 20;

    for (let i = 0; i < maxIterations; i++) {
        const response = await llmRouter.chat({
            messages,
            tools: activeDefs,
        });

        if (response.toolCalls && response.toolCalls.length > 0) {
            spinner.stop();

            // Add assistant response with tool calls
            conversation.addAssistant(response.content || '', response.toolCalls);
            messages.push({ role: 'assistant' as const, content: response.content || '', toolCalls: response.toolCalls });

            for (const tc of response.toolCalls) {
                const tool = registry.get(tc.name);
                if (!tool) {
                    const errMsg = JSON.stringify({ error: `Tool ${tc.name} not found` });
                    conversation.addToolResult(errMsg, tc.id);
                    messages.push({ role: 'tool' as const, content: errMsg, toolCallId: tc.id });
                    continue;
                }

                // Permission check
                const permResult = await policy.checkPermission(
                    {
                        tool: tc.name,
                        operation: tc.name,
                        description: `Calling ${tc.name}`,
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
                            description: `Calling ${tc.name}`,
                            permissions: tool.permissions,
                            args: tc.args as Record<string, unknown>,
                            riskLevel: 'medium',
                        },
                        ctx
                    );
                    if (!approved) {
                        const errMsg = JSON.stringify({ error: 'Permission denied by user' });
                        conversation.addToolResult(errMsg, tc.id);
                        messages.push({ role: 'tool' as const, content: errMsg, toolCallId: tc.id });
                        continue;
                    }
                } else if (!permResult.allowed) {
                    const errMsg = JSON.stringify({ error: permResult.reason });
                    conversation.addToolResult(errMsg, tc.id);
                    messages.push({ role: 'tool' as const, content: errMsg, toolCallId: tc.id });
                    continue;
                }

                // Execute tool with inline display
                renderToolCall(tc.name, tc.args, 'running');
                const result = await registry.execute(tc.name, tc.args, ctx);

                if (result.success) {
                    renderToolCall(tc.name, tc.args, 'success');
                } else {
                    renderToolCall(tc.name, tc.args, 'error', result.error);
                }

                const resultStr = JSON.stringify(result.data ?? { error: result.error });
                conversation.addToolResult(resultStr, tc.id);
                messages.push({ role: 'tool' as const, content: resultStr, toolCallId: tc.id });
            }

            // Continue the loop for next LLM response
            spinner.start('Thinking...');
        } else {
            // No tool calls — LLM finished, display response
            spinner.stop();

            if (response.content) {
                conversation.addAssistant(response.content);
                console.log();
                console.log('  ' + response.content.split('\n').join('\n  '));
                if (deps.socket && deps.instanceId) {
                    deps.socket.emit('agent:log', { instanceId: deps.instanceId, text: response.content, type: 'result' });
                }
            }

            renderSummary('Done', Date.now() - start);

            // ─── Episodic Memory Storage ───
            // Only save if we actually did something (more than just the initial system + user messages)
            const newMessages = conversation.getMessages().slice(2);
            if (newMessages.some(m => m.role === 'tool' || m.toolCalls)) {
                try {
                    // Extract what tools were called and what the final AI summary was
                    const executionHistory = newMessages.map(m => {
                        if (m.role === 'assistant' && m.toolCalls) {
                            return m.toolCalls.map(tc => `Tool ${tc.name}(${JSON.stringify(tc.args)})`).join(', ');
                        } else if (m.role === 'tool') {
                            // truncate really long contents to save space
                            return `Result: ${m.content.length > 500 ? m.content.substring(0, 500) + '...' : m.content}`;
                        } else if (m.role === 'assistant' && m.content) {
                            return `Final: ${m.content}`;
                        }
                        return '';
                    }).filter(s => s).join('\n');

                    // Let's generate an embedding. If it fails, we just don't save the memory (e.g. offline provider)
                    const userEmbedding = await llmRouter.generateEmbedding(userMessage).catch(() => null);

                    if (userEmbedding) {
                        const memoryDir = getRunsDir();
                        const memory = EpisodicMemory.open(memoryDir);
                        memory.saveEpisode(userMessage, executionHistory, userEmbedding);
                        memory.close();
                        ctx.onProgress?.(`Saved execution to Episodic Memory for future recall.`);
                    }
                } catch (e) {
                    // Soft fail if memory writing fails
                }
            }

            break;
        }
    }

    rl.prompt();
}
