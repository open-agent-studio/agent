import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { InstanceRegistry } from '../instance/registry.js';
import { resolve, join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { getAgentDir } from '../utils/paths.js';
import { MemoryStore } from '../memory/store.js';
import { GoalStore } from '../goals/store.js';
import { ConfigLoader } from '../config/loader.js';
import { PluginLoader } from '../plugins/loader.js';
import { SkillLoader } from '../skills/loader.js';
import { CommandLoader } from '../commands/loader.js';
import { ScriptLoader } from '../scripts/loader.js';

export function createStudioServer() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });
    const registry = new InstanceRegistry();

    app.use(cors());
    app.use(express.json());

    // --- INSTANCES API ---
    app.get('/api/instances', async (req, res) => {
        try {
            const instances = await registry.listActive();
            res.json(instances);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) return res.status(404).json({ error: 'Instance not found' });
            res.json(inst);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // --- OBSERVABILITY API ---
    app.get('/api/instances/:id/memory', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) return res.status(404).json({ error: 'Instance not found' });

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

    app.get('/api/instances/:id/goals', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) return res.status(404).json({ error: 'Instance not found' });

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
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id/capabilities', async (req, res) => {
        try {
            const instances = await registry.listActive();
            const inst = instances.find(i => i.id === req.params.id);
            if (!inst) return res.status(404).json({ error: 'Instance not found' });

            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const skillLoader = new SkillLoader(config);
            const cmdLoader = new CommandLoader();
            const pluginLoader = new PluginLoader(config);
            const scriptLoader = new ScriptLoader();

            // Load all capabilities from the agent's CWD
            await skillLoader.loadAll(config.skills.installPaths, inst.cwd);
            await cmdLoader.loadProjectCommands(inst.cwd);
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], inst.cwd);

            const loadedPlugins = await pluginLoader.loadAll(config.plugins.installPaths, inst.cwd);

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

    // --- SOCKET.IO FOR LIVE LOGS ---
    io.on('connection', (socket) => {
        console.log(`[Studio] Client connected: ${socket.id}`);
        // Here we will eventually stream tail -f from daemon.log or repl stdout
        socket.on('disconnect', () => {
            console.log(`[Studio] Client disconnected: ${socket.id}`);
        });
    });

    // --- SERVE FRONTEND ---
    const reactAppPath = resolve(process.cwd(), 'studio/dist');
    app.use(express.static(reactAppPath));
    app.get('*', (req, res) => res.sendFile(resolve(reactAppPath, 'index.html')));

    return server;
}
