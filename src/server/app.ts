import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { InstanceRegistry } from '../instance/registry.js';
import { resolve, join } from 'node:path';
import { MemoryStore } from '../memory/store.js';
import { GoalStore } from '../goals/store.js';
import { ConfigLoader } from '../config/loader.js';
import { PluginLoader } from '../plugins/loader.js';
import { SkillLoader } from '../skills/loader.js';
import { CommandLoader } from '../commands/loader.js';
import { ScriptLoader } from '../scripts/loader.js';
import { HookRegistry } from '../hooks/registry.js';
import { DaemonManager } from '../daemon/manager.js';
import { writeFile, mkdir, readFile, readdir, rm, access } from 'node:fs/promises';

export function createStudioServer() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });
    const registry = new InstanceRegistry();

    app.use(cors());
    app.use(express.json());

    // ═══════════════════════════════════════════════
    // HELPER: resolve instance by ID
    // ═══════════════════════════════════════════════
    async function resolveInstance(id: string) {
        const instances = await registry.listActive();
        return instances.find(i => i.id === id) ?? null;
    }

    // ═══════════════════════════════════════════════
    // INSTANCES API
    // ═══════════════════════════════════════════════
    app.get('/api/instances', async (_req, res) => {
        try {
            const instances = await registry.listActive();
            res.json(instances);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }
            res.json(inst);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // MEMORY API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/memory', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const memories = memoryStore.list(undefined, 100);

            res.json({
                stats: memoryStore.stats(),
                memories
            });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id/memory/search', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const q = req.query.q as string;
            if (!q) { res.status(400).json({ error: 'Query parameter "q" required' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const results = memoryStore.search(q, 20);
            res.json({ results });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/memory', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { content, category, tags } = req.body;
            if (!content) { res.status(400).json({ error: 'Content required' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const memory = memoryStore.save(content, category || 'general', 'user', tags || []);
            res.json(memory);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/memory/:memoryId', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const ok = memoryStore.forget(parseInt(req.params.memoryId));
            res.json({ success: ok });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // GOALS & TASKS API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/goals', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);

            const db = (memoryStore as any).db;
            const goals = db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all();
            const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();

            const goalsWithTasks = goals.map((g: any) => ({
                ...g,
                tasks: tasks.filter((t: any) => t.goal_id === g.id)
            }));

            res.json({
                stats: goalStore.stats(),
                goals: goalsWithTasks
            });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/goals', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { title, description, priority, deadline } = req.body;
            if (!title) { res.status(400).json({ error: 'Title required' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);
            const goal = goalStore.addGoal(title, { description, priority, deadline });
            res.json(goal);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.put('/api/instances/:id/goals/:goalId/status', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { status } = req.body;
            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);
            goalStore.updateGoalStatus(parseInt(req.params.goalId), status);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/goals/:goalId', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);
            const ok = goalStore.removeGoal(parseInt(req.params.goalId));
            res.json({ success: ok });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/goals/:goalId/tasks', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { title, description, skill, dependsOn, requiresApproval } = req.body;
            if (!title) { res.status(400).json({ error: 'Title required' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);
            const task = goalStore.addTask(parseInt(req.params.goalId), title, {
                description, skill, dependsOn, requiresApproval
            });
            res.json(task);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/tasks/:taskId/approve', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);
            const ok = goalStore.approveTask(parseInt(req.params.taskId));
            res.json({ success: ok });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // CAPABILITIES API (read-only)
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/capabilities', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const skillLoader = new SkillLoader(config);
            const cmdLoader = new CommandLoader();
            const pluginLoader = new PluginLoader();
            const scriptLoader = new ScriptLoader();
            const hookRegistry = new HookRegistry();

            await skillLoader.loadAll();
            await cmdLoader.loadProjectCommands(inst.cwd);
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], inst.cwd);
            await hookRegistry.loadProjectHooks(inst.cwd);

            const loadedPlugins = await pluginLoader.loadAll(config.plugins.installPaths, inst.cwd, skillLoader, cmdLoader, hookRegistry, scriptLoader);

            res.json({
                skills: skillLoader.list(),
                commands: cmdLoader.list(),
                scripts: scriptLoader.list(),
                plugins: loadedPlugins
            });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // SKILLS CRUD API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/skills', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const skillLoader = new SkillLoader(config);
            await skillLoader.loadAll();

            const skills = skillLoader.list().map(s => ({
                name: s.manifest.name,
                description: s.manifest.description,
                version: s.manifest.version,
                entrypoint: s.manifest.entrypoint,
                tools: s.manifest.tools,
                path: s.path,
                promptContent: s.promptContent ?? null,
            }));

            res.json({ skills });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/skills', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { name, description, prompt, tools } = req.body;
            if (!name) { res.status(400).json({ error: 'Name required' }); return; }

            const skillDir = join(inst.cwd, '.agent', 'skills', name);
            await mkdir(skillDir, { recursive: true });

            const manifest = {
                name,
                description: description || `Skill: ${name}`,
                version: '1.0.0',
                entrypoint: 'prompt.md',
                tools: tools || [],
            };

            await writeFile(join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2));
            await writeFile(join(skillDir, 'prompt.md'), prompt || `# ${name}\n\nDescribe the skill behavior here.`);

            res.json({ success: true, path: skillDir, manifest });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.put('/api/instances/:id/skills/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { prompt, description, tools } = req.body;
            const skillDir = join(inst.cwd, '.agent', 'skills', req.params.name);

            try { await access(skillDir); } catch {
                res.status(404).json({ error: 'Skill not found' }); return;
            }

            if (prompt !== undefined) {
                await writeFile(join(skillDir, 'prompt.md'), prompt);
            }

            if (description !== undefined || tools !== undefined) {
                const manifestRaw = await readFile(join(skillDir, 'skill.json'), 'utf-8');
                const manifest = JSON.parse(manifestRaw);
                if (description !== undefined) manifest.description = description;
                if (tools !== undefined) manifest.tools = tools;
                await writeFile(join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2));
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/skills/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const skillDir = join(inst.cwd, '.agent', 'skills', req.params.name);
            await rm(skillDir, { recursive: true, force: true });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // COMMANDS CRUD API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/commands', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const cmdLoader = new CommandLoader();
            await cmdLoader.loadProjectCommands(inst.cwd);

            res.json({ commands: cmdLoader.list() });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/commands', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { name, description, tools, body } = req.body;
            if (!name) { res.status(400).json({ error: 'Name required' }); return; }

            const commandsDir = join(inst.cwd, '.agent', 'commands');
            await mkdir(commandsDir, { recursive: true });

            const frontmatter = [
                '---',
                `name: ${name}`,
                `description: ${description || `Command: ${name}`}`,
                `tools: [${(tools || []).join(', ')}]`,
                '---',
            ].join('\n');

            const content = `${frontmatter}\n${body || `# ${name}\n\nDescribe what this command does.`}`;
            const filePath = join(commandsDir, `${name}.md`);
            await writeFile(filePath, content);

            res.json({ success: true, path: filePath });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/commands/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const filePath = join(inst.cwd, '.agent', 'commands', `${req.params.name}.md`);
            await rm(filePath, { force: true });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // SCRIPTS CRUD API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/scripts', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], inst.cwd);

            res.json({ scripts: scriptLoader.list() });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/scripts', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { name, description, entrypoint, content, args } = req.body;
            if (!name) { res.status(400).json({ error: 'Name required' }); return; }

            const scriptDir = join(inst.cwd, '.agent', 'scripts', name);
            await mkdir(scriptDir, { recursive: true });

            // Write script.yaml
            const yamlLines = [
                `name: ${name}`,
                `description: ${description || `Script: ${name}`}`,
                `entrypoint: ${entrypoint || 'run.sh'}`,
            ];
            if (args && Object.keys(args).length > 0) {
                yamlLines.push('args:');
                for (const [key, val] of Object.entries(args)) {
                    yamlLines.push(`  ${key}:`);
                    yamlLines.push(`    description: ${(val as any).description || key}`);
                    if ((val as any).default) yamlLines.push(`    default: ${(val as any).default}`);
                }
            }
            await writeFile(join(scriptDir, 'script.yaml'), yamlLines.join('\n'));

            // Write entrypoint file
            const ep = entrypoint || 'run.sh';
            await writeFile(join(scriptDir, ep), content || `#!/bin/bash\necho "Running ${name}..."\n`);

            res.json({ success: true, path: scriptDir });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/scripts/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const scriptDir = join(inst.cwd, '.agent', 'scripts', req.params.name);
            // Also handle standalone files
            const standaloneFile = join(inst.cwd, '.agent', 'scripts', req.params.name);
            try {
                await rm(scriptDir, { recursive: true, force: true });
            } catch {
                // try standalone file patterns
                for (const ext of ['.sh', '.py', '.js', '.ts']) {
                    try { await rm(standaloneFile + ext, { force: true }); } catch { /* skip */ }
                }
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // Get script content
    app.get('/api/instances/:id/scripts/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], inst.cwd);

            const script = scriptLoader.get(req.params.name);
            if (!script) { res.status(404).json({ error: 'Script not found' }); return; }

            const content = await readFile(script.entrypointPath, 'utf-8');
            res.json({
                name: script.manifest.name,
                description: script.manifest.description,
                entrypoint: script.manifest.entrypoint,
                path: script.path,
                entrypointPath: script.entrypointPath,
                content,
                manifest: script.manifest,
            });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // Run a script
    app.post('/api/instances/:id/scripts/:name/run', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const scriptLoader = new ScriptLoader();
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], inst.cwd);

            const script = scriptLoader.get(req.params.name);
            if (!script) { res.status(404).json({ error: 'Script not found' }); return; }

            const { ScriptRunner } = await import('../scripts/runner.js');
            const runner = new ScriptRunner();
            const result = await runner.run(script, req.body.args || {}, {
                projectRoot: inst.cwd,
            });

            res.json(result);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // PLUGINS API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/plugins', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const pluginsDir = join(inst.cwd, '.agent', 'plugins');
            const plugins: any[] = [];

            try {
                await access(pluginsDir);
                const entries = await readdir(pluginsDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    try {
                        const manifestRaw = await readFile(join(pluginsDir, entry.name, 'plugin.json'), 'utf-8');
                        plugins.push(JSON.parse(manifestRaw));
                    } catch { /* skip invalid */ }
                }
            } catch { /* no plugin dir */ }

            res.json({ plugins });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/plugins/:name', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const pluginDir = join(inst.cwd, '.agent', 'plugins', req.params.name);
            await rm(pluginDir, { recursive: true, force: true });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // DAEMON CONTROL API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/daemon/status', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const daemon = new DaemonManager(inst.cwd);
            const status = await daemon.status();
            res.json(status);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/daemon/start', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const daemon = new DaemonManager(inst.cwd);
            const result = await daemon.start();
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/daemon/stop', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const daemon = new DaemonManager(inst.cwd);
            const result = await daemon.stop();
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id/daemon/logs', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const daemon = new DaemonManager(inst.cwd);
            const lines = parseInt(req.query.lines as string) || 50;
            const logs = await daemon.getLogs(lines);
            res.json({ logs });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // SOCKET.IO FOR LIVE LOGS & APPROVAL RELAY
    // ═══════════════════════════════════════════════
    io.on('connection', (socket) => {
        console.log(`[Studio] Client connected: ${socket.id}`);

        socket.on('subscribe', (instanceId: string) => {
            console.log(`[Studio] Client subscribed to ${instanceId}`);
            socket.join(instanceId);
        });

        socket.on('agent:command', (data: { instanceId: string, command: string }) => {
            socket.to(data.instanceId).emit('agent:command', data);
        });

        socket.on('agent:log', (data: { instanceId: string, text: string, type: string }) => {
            socket.to(data.instanceId).emit('agent:log', data);
        });

        socket.on('agent:approval:request', (data: { instanceId: string, action: any }) => {
            socket.to(data.instanceId).emit('agent:approval:request', data);
        });

        socket.on('agent:approval:response', (data: { instanceId: string, tool: string, approved: boolean }) => {
            socket.to(data.instanceId).emit(`agent:approval:response:${data.tool}`, data);
        });

        socket.on('disconnect', () => {
            console.log(`[Studio] Client disconnected: ${socket.id}`);
        });
    });

    // ═══════════════════════════════════════════════
    // SERVE FRONTEND
    // ═══════════════════════════════════════════════
    const reactAppPath = resolve(process.cwd(), 'studio/dist');
    app.use(express.static(reactAppPath));
    app.use((_req, res) => { res.sendFile(resolve(reactAppPath, 'index.html')); });

    return server;
}
