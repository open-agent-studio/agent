import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { InstanceRegistry } from '../instance/registry.js';
import { resolve } from 'node:path';
import { MemoryStore } from '../memory/store.js';
import { GoalStore } from '../goals/store.js';
import { ConfigLoader } from '../config/loader.js';
import { PluginLoader } from '../plugins/loader.js';
import { SkillLoader } from '../skills/loader.js';
import { CommandLoader } from '../commands/loader.js';
import { ScriptLoader } from '../scripts/loader.js';
import { HookRegistry } from '../hooks/registry.js';

export function createStudioServer() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });
    const registry = new InstanceRegistry();

    app.use(cors());
    app.use(express.json());

    // --- INSTANCES API ---
    app.get('/api/instances', async (_req, res) => {
        try {
            const instances = await registry.listActive();
            res.json(instances);
            return;
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
            return;
        }
    });

    app.get('/api/instances/:id', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }
            res.json(inst);
            return;
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
            return;
        }
    });

    // --- OBSERVABILITY API ---
    app.get('/api/instances/:id/memory', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const memories = memoryStore.list(undefined, 100);

            res.json({
                stats: memoryStore.stats(),
                memories
            });
            return;
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
            return;
        }
    });

    app.get('/api/instances/:id/goals', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const memoryStore = MemoryStore.open(inst.cwd);
            const goalStore = new GoalStore(memoryStore);

            // Get all tasks and cluster them by goal
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
            return;
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
            return;
        }
    });

    app.get('/api/instances/:id/capabilities', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const skillLoader = new SkillLoader(config);
            const cmdLoader = new CommandLoader();
            const pluginLoader = new PluginLoader();
            const scriptLoader = new ScriptLoader();
            const hookRegistry = new HookRegistry();

            // Load all capabilities from the agent's CWD
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
            return;
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
            return;
        }
    });

    // --- SOCKET.IO FOR LIVE LOGS ---
    io.on('connection', (socket) => {
        console.log(`[Studio] Client connected: ${socket.id}`);

        socket.on('subscribe', (instanceId: string) => {
            console.log(`[Studio] Client subscribed to ${instanceId}`);
            socket.join(instanceId);
        });

        socket.on('agent:command', (data: { instanceId: string, command: string }) => {
            console.log(`[Studio] Received command for ${data.instanceId}: ${data.command}`);

            // For now, simply mock a system processing response and result 
            // since we don't have an IPC bridge built into the active CLI instances yet
            setTimeout(() => {
                io.to(socket.id).emit('agent:log', {
                    instanceId: data.instanceId,
                    text: `[System] Processing command: "${data.command}"...`,
                    type: 'system'
                });
            }, 300);

            setTimeout(() => {
                let response = `Command executed successfully.`;
                if (data.command.toLowerCase().includes('hi') || data.command.toLowerCase().includes('hello')) {
                    response = `Hello! I am connected and receiving your commands.`;
                }

                io.to(socket.id).emit('agent:log', {
                    instanceId: data.instanceId,
                    text: response,
                    type: 'result'
                });
            }, 1200);
        });

        socket.on('disconnect', () => {
            console.log(`[Studio] Client disconnected: ${socket.id}`);
        });
    });

    // --- SERVE FRONTEND ---
    const reactAppPath = resolve(process.cwd(), 'studio/dist');
    app.use(express.static(reactAppPath));
    app.use((_req, res) => { res.sendFile(resolve(reactAppPath, 'index.html')); });

    return server;
}
