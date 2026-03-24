import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { InstanceRegistry } from '../instance/registry.js';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { authMiddleware, generateApiKey, listApiKeys, revokeApiKey } from './auth.js';

export function createStudioServer() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });
    const registry = new InstanceRegistry();

    app.use(cors());
    app.use(express.json());

    // ─── API Authentication ───
    // Apply auth middleware to all /api/* routes
    // Skips: GET /api/health, GET /api/instances, non-API routes
    app.use(authMiddleware);

    // ─── Auth Key Management API ───
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
    });

    app.post('/api/auth/keys', async (req, res) => {
        try {
            const label = (req.body as any)?.label || 'studio-generated';
            const { rawKey, entry } = await generateApiKey(label);
            res.json({ key: rawKey, id: entry.id, label: entry.label, createdAt: entry.createdAt });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/auth/keys', async (_req, res) => {
        try {
            const keys = await listApiKeys();
            // Never return the full hash — show only metadata
            res.json(keys.map(k => ({ id: k.id, label: k.label, createdAt: k.createdAt })));
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/auth/keys/:id', async (req, res) => {
        try {
            const ok = await revokeApiKey(req.params.id);
            if (!ok) { res.status(404).json({ error: 'Key not found' }); return; }
            res.json({ deleted: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

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

            const loadedPlugins = await pluginLoader.loadAll(config.plugins?.installPaths ?? ['.agent/plugins'], inst.cwd, skillLoader, cmdLoader, hookRegistry, scriptLoader);

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
    // GOAL TEMPLATES API
    // ═══════════════════════════════════════════════
    app.get('/api/goal-templates', (_req, res) => {
        res.json({
            templates: [
                {
                    id: 'system-monitor',
                    icon: '📊',
                    title: 'System Health Monitor',
                    description: 'Create a system monitoring dashboard with automated health checks',
                    goal: {
                        title: 'Build system health monitoring',
                        description: 'Create an HTML dashboard showing system hostname, CPU, memory, disk usage, and uptime. Include a script that refreshes the data. Add a README.',
                    },
                    tags: ['devops', 'monitoring'],
                },
                {
                    id: 'blog-writer',
                    icon: '✍️',
                    title: 'Blog Post Writer',
                    description: 'Research a topic and write a professional blog post with SEO',
                    goal: {
                        title: 'Write a blog post about {topic}',
                        description: 'Research the topic, write a 1000-word blog post in Markdown format with proper headings, code examples if relevant, and SEO-friendly meta description. Save as blog-post.md.',
                    },
                    variables: [{ name: 'topic', label: 'Blog Topic', placeholder: 'e.g. AI agents in 2026' }],
                    tags: ['content', 'writing'],
                },
                {
                    id: 'apify-actor',
                    icon: '🕷️',
                    title: 'Apify Actor Creator',
                    description: 'Scaffold and configure a new Apify web scraping actor',
                    goal: {
                        title: 'Create Apify actor for {website}',
                        description: 'Create a new Apify actor project that scrapes {website}. Include: actor.json, INPUT_SCHEMA.json, Dockerfile, package.json, src/main.js with Crawlee + Playwright, and README.md. The actor should extract key data points from the website.',
                    },
                    variables: [{ name: 'website', label: 'Target Website', placeholder: 'e.g. Amazon product pages' }],
                    tags: ['scraping', 'apify'],
                },
                {
                    id: 'code-review',
                    icon: '🔍',
                    title: 'Code Review & Refactor',
                    description: 'Analyze a codebase, identify issues, and suggest improvements',
                    goal: {
                        title: 'Review and improve codebase',
                        description: 'Analyze the project codebase: identify code smells, security issues, performance bottlenecks, and missing tests. Create a code-review.md report with findings and recommendations. Implement the top 3 quick-win improvements.',
                    },
                    tags: ['code-quality', 'refactoring'],
                },
                {
                    id: 'data-pipeline',
                    icon: '🔄',
                    title: 'Data Pipeline',
                    description: 'Create a data processing pipeline with input, transform, and output',
                    goal: {
                        title: 'Build data pipeline for {source}',
                        description: 'Create a data pipeline that: 1) Fetches data from {source}, 2) Transforms and cleans the data, 3) Outputs results to a JSON file. Include error handling, logging, and a script to run the pipeline.',
                    },
                    variables: [{ name: 'source', label: 'Data Source', placeholder: 'e.g. GitHub API repos list' }],
                    tags: ['data', 'automation'],
                },
                {
                    id: 'recurring-report',
                    icon: '📅',
                    title: 'Recurring Report',
                    description: 'Generate automated reports on a schedule',
                    goal: {
                        title: 'Daily {report_type} report',
                        description: 'Create a recurring task that generates a {report_type} report daily. The report should include current date, key metrics, and be saved as reports/YYYY-MM-DD.md.',
                    },
                    variables: [{ name: 'report_type', label: 'Report Type', placeholder: 'e.g. system status, git activity' }],
                    recurrence: 'daily',
                    tags: ['reporting', 'recurring'],
                },
            ],
        });
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
    // CREDENTIALS / VAULT API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/credentials', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { CredentialStore } = await import('../credentials/store.js');
            const store = new CredentialStore(inst.cwd);
            const keys = await store.list();
            res.json({ keys });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/credentials', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { key, value } = req.body;
            if (!key || !value) { res.status(400).json({ error: 'key and value required' }); return; }

            const { CredentialStore } = await import('../credentials/store.js');
            const store = new CredentialStore(inst.cwd);
            await store.set(key, value);
            res.json({ success: true, key });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.delete('/api/instances/:id/credentials/:key', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { CredentialStore } = await import('../credentials/store.js');
            const store = new CredentialStore(inst.cwd);
            await store.delete(req.params.key);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // MULTI-MODEL SETTINGS API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/settings/models', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { ConfigLoader } = await import('../config/loader.js');
            const loader = new ConfigLoader();
            await loader.load();
            const config = loader.get();
            
            const { CredentialStore } = await import('../credentials/store.js');
            const store = new CredentialStore(inst.cwd);
            const vaultKeys = await store.list();

            const providers = {
                openai: {
                    configured: vaultKeys.includes('OPENAI_API_KEY') || !!process.env.OPENAI_API_KEY,
                    model: config.models?.providers?.openai?.model || 'gpt-4o'
                },
                anthropic: {
                    configured: vaultKeys.includes('ANTHROPIC_API_KEY') || !!process.env.ANTHROPIC_API_KEY,
                    model: config.models?.providers?.anthropic?.model || 'claude-3-5-sonnet-20241022'
                },
                google: {
                    configured: vaultKeys.includes('GEMINI_API_KEY') || !!process.env.GEMINI_API_KEY,
                    model: config.models?.providers?.google?.model || 'gemini-1.5-pro'
                },
                groq: {
                    configured: vaultKeys.includes('GROQ_API_KEY') || !!process.env.GROQ_API_KEY,
                    model: config.models?.providers?.groq?.model || 'llama3-70b-8192'
                },
                ollama: {
                    configured: true,
                    model: config.models?.providers?.ollama?.model || 'llama3.1'
                }
            };

            res.json({
                defaultProvider: config.models?.routing?.defaultProvider || 'openai',
                providers
            });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.post('/api/instances/:id/settings/models', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { provider, model, apiKey } = req.body;
            
            const { ConfigLoader } = await import('../config/loader.js');
            const loader = new ConfigLoader();
            await loader.load();

            if (provider) {
                await loader.setValue('models.routing.defaultProvider', provider);
            }
            if (model && provider) {
                await loader.setValue(`models.providers.${provider}.model`, model);
            }

            if (apiKey && provider) {
                const { CredentialStore } = await import('../credentials/store.js');
                const store = new CredentialStore(inst.cwd);
                let keyName = '';
                switch (provider) {
                    case 'openai': keyName = 'OPENAI_API_KEY'; break;
                    case 'anthropic': keyName = 'ANTHROPIC_API_KEY'; break;
                    case 'google': keyName = 'GEMINI_API_KEY'; break;
                    case 'groq': keyName = 'GROQ_API_KEY'; break;
                }
                if (keyName) {
                    await store.set(keyName, apiKey);
                }
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // ═══════════════════════════════════════════════
    // COST TRACKING API
    // ═══════════════════════════════════════════════
    app.get('/api/instances/:id/costs/summary', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { CostTracker } = await import('../plugins/cost-tracker/index.js');
            const tracker = new CostTracker(inst.cwd);
            const summary = await tracker.getSummary();
            res.json(summary);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    app.get('/api/instances/:id/costs/recent', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { CostTracker } = await import('../plugins/cost-tracker/index.js');
            const tracker = new CostTracker(inst.cwd);
            const limit = parseInt(req.query.limit as string) || 50;
            const entries = await tracker.getRecent(limit);
            res.json({ entries });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    // Notifications log
    app.get('/api/instances/:id/notifications', async (req, res) => {
        try {
            const inst = await resolveInstance(req.params.id);
            if (!inst) { res.status(404).json({ error: 'Instance not found' }); return; }

            const { readFile } = await import('node:fs/promises');
            const logPath = join(inst.cwd, '.agent', 'notifications.log');
            try {
                const raw = await readFile(logPath, 'utf-8');
                const lines = raw.trim().split('\n').filter(Boolean).slice(-100);
                // Parse: [2026-03-03T10:00:00.000Z] [SUCCESS] Goal Completed: "Deploy app" — 5 tasks done
                const notifications = lines.map(line => {
                    const match = line.match(/^\[(.+?)\]\s+\[(\w+)\]\s+(.+?):\s+(.+)$/);
                    if (match) {
                        return { timestamp: match[1], level: match[2].toLowerCase(), title: match[3], message: match[4] };
                    }
                    return { timestamp: new Date().toISOString(), level: 'info', title: 'Notification', message: line };
                }).reverse();
                res.json({ notifications });
            } catch {
                res.json({ notifications: [] });
            }
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

        // Credential capture flow
        socket.on('credential:required', (data: { instanceId: string, key: string, reason: string, requestId: string }) => {
            socket.to(data.instanceId).emit('credential:required', data);
        });

        socket.on('credential:provide', (data: { instanceId: string, key: string, value: string, requestId: string }) => {
            socket.to(data.instanceId).emit('credential:provide', data);
        });

        // Live task streaming
        socket.on('task:progress', (data: { instanceId: string, taskId: number, event: string, data: any }) => {
            socket.to(data.instanceId).emit('task:progress', data);
        });

        socket.on('disconnect', () => {
            console.log(`[Studio] Client disconnected: ${socket.id}`);
        });
    });

    // ═══════════════════════════════════════════════
    // SANDBOX API
    // ═══════════════════════════════════════════════
    app.get('/api/sandbox/status', async (_req, res) => {
        try {
            const { getSandboxEngine } = await import('../sandbox/engine.js');
            const engine = getSandboxEngine();
            if (!engine) { res.json({ enabled: false, running: false, image: 'node:20-slim' }); return; }
            const status = await engine.status();
            res.json(status);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/sandbox/start', async (_req, res) => {
        try {
            const { initSandboxEngine } = await import('../sandbox/engine.js');
            const engine = initSandboxEngine(process.cwd(), { enabled: true });
            const container = await engine.start();
            res.json(container);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/sandbox/stop', async (_req, res) => {
        try {
            const { getSandboxEngine } = await import('../sandbox/engine.js');
            const engine = getSandboxEngine();
            if (engine) await engine.stop();
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    // ═══════════════════════════════════════════════
    // SWARM API
    // ═══════════════════════════════════════════════
    app.get('/api/swarm/status', async (_req, res) => {
        try {
            const { getSwarmOrchestrator } = await import('../swarm/orchestrator.js');
            const orch = getSwarmOrchestrator();
            if (!orch) { res.json({ swarmId: '', status: 'idle', agents: [], tasks: [] }); return; }
            res.json(orch.getStatus());
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/swarm/start', async (req, res) => {
        try {
            const { goal } = req.body;
            if (!goal) { res.status(400).json({ error: 'Goal is required' }); return; }
            const { initSwarmOrchestrator, getSwarmOrchestrator } = await import('../swarm/orchestrator.js');
            // Stop any existing swarm
            const existing = getSwarmOrchestrator();
            if (existing && existing.isActive) { existing.stop(); }
            const orch = initSwarmOrchestrator({ enabled: true });
            // Run async — don't await, let it work in the background
            orch.run(goal).catch(console.error);
            // Return immediately with the initial status
            res.json(orch.getStatus());
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/swarm/stop', async (_req, res) => {
        try {
            const { getSwarmOrchestrator } = await import('../swarm/orchestrator.js');
            const orch = getSwarmOrchestrator();
            if (orch) orch.stop();
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    // ═══════════════════════════════════════════════
    // DESKTOP API
    // ═══════════════════════════════════════════════
    app.post('/api/desktop/screenshot', async (_req, res) => {
        try {
            const { initDesktopEngine } = await import('../desktop/engine.js');
            const engine = initDesktopEngine({ enabled: true });
            const result = await engine.screenshot();
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/desktop/click', async (req, res) => {
        try {
            const { initDesktopEngine } = await import('../desktop/engine.js');
            const engine = initDesktopEngine({ enabled: true });
            const result = await engine.mouseAction({ type: 'click', x: req.body.x, y: req.body.y });
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/desktop/type', async (req, res) => {
        try {
            const { initDesktopEngine } = await import('../desktop/engine.js');
            const engine = initDesktopEngine({ enabled: true });
            const result = await engine.typeText(req.body.text);
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/desktop/hotkey', async (req, res) => {
        try {
            const { initDesktopEngine } = await import('../desktop/engine.js');
            const engine = initDesktopEngine({ enabled: true });
            const parts = req.body.combo.split('+');
            const key = parts.pop();
            const result = await engine.hotkey(key, parts);
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    // ═══════════════════════════════════════════════
    // MULTIMODAL API
    // ═══════════════════════════════════════════════
    const upload = multer({ dest: '/tmp/agent-uploads/' });

    app.post('/api/multimodal/transcribe', upload.single('audio'), async (req, res) => {
        try {
            if (!req.file) { res.status(400).json({ error: 'No audio file uploaded' }); return; }
            const { initMultimodalEngine } = await import('../multimodal/engine.js');
            const engine = initMultimodalEngine({ enabled: true });
            const result = await engine.transcribe(req.file.path);
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/multimodal/analyze', upload.single('image'), async (req, res) => {
        try {
            if (!req.file) { res.status(400).json({ error: 'No image file uploaded' }); return; }
            const prompt = req.body.prompt || 'Describe this image in detail.';
            const { initMultimodalEngine } = await import('../multimodal/engine.js');
            const engine = initMultimodalEngine({ enabled: true });
            const result = await engine.analyzeImage(req.file.path, prompt);
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    app.post('/api/multimodal/speak', async (req, res) => {
        try {
            const { initMultimodalEngine } = await import('../multimodal/engine.js');
            const engine = initMultimodalEngine({ enabled: true, tts: { model: 'tts-1', voice: req.body.voice || 'alloy', format: 'mp3', speed: 1.0 } });
            const result = await engine.speak(req.body.text);
            res.json(result);
        } catch (err) { res.status(500).json({ error: (err as Error).message }); }
    });

    // ═══════════════════════════════════════════════
    // REMOTE EXECUTION (AGENT CLOUD API)
    // ═══════════════════════════════════════════════
    app.post('/api/execute', async (req, res) => {
        const { goal } = req.body;
        if (!goal) {
            res.status(400).json({ error: 'Goal is required' });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendEvent = (type: string, data: any) => {
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const { ToolRegistry } = await import('../tools/registry.js');
            const { registerCoreTools } = await import('../cli/commands/init.js');
            const { LLMRouter } = await import('../llm/router.js');
            const { SkillLoader } = await import('../skills/loader.js');
            const { ScriptLoader } = await import('../scripts/loader.js');
            const { zodToJsonSchema } = await import('../utils/schema.js');

            const registry = ToolRegistry.getInstance();
            registerCoreTools(registry);

            const skillLoader = new SkillLoader(config);
            const scriptLoader = new ScriptLoader();
            const llmRouter = new LLMRouter(config);

            await skillLoader.loadAll();
            await scriptLoader.loadAll(config.scripts?.installPaths ?? ['.agent/scripts'], process.cwd());

            const ctx = {
                runId: Date.now().toString(),
                cwd: process.cwd(),
                config,
                autonomous: true, // Server executes autonomously
                dryRun: false,
                approvedPermissions: new Set<string>(),
                onApproval: async () => true,
                onProgress: (msg: string) => sendEvent('progress', { message: msg }),
            };

            const allTools = registry.list();
            const toolDefs = allTools.map((t: any) => {
                const fullTool = registry.get(t.name);
                return {
                    name: t.name,
                    description: t.description,
                    inputSchema: fullTool ? zodToJsonSchema(fullTool.inputSchema) : {},
                };
            });

            const messages: any[] = [
                {
                    role: 'system',
                    content: `You are an agent that accomplishes tasks using available tools.
You have access to the following tools: ${toolDefs.map((t: any) => t.name).join(', ')}.
INSTRUCTIONS:
1. Use available tools to complete the user's goal step by step.
2. Be proactive: if the user wants an action (open app, create file), DO IT. Do not just explain how.
3. When done, provide a final summary.`,
                },
                { role: 'user', content: goal },
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
                            sendEvent('warning', { message: `Tool "${tc.name}" not found` });
                            messages.push({ role: 'tool', content: JSON.stringify({ error: `Tool ${tc.name} not found` }), toolCallId: tc.id });
                            continue;
                        }

                        sendEvent('progress', { message: `⚡ ${tc.name}(...)` });
                        const result = await registry.execute(tc.name, tc.args, ctx);

                        if (result.success) {
                            sendEvent('success', { message: `  ✓ ${tc.name} succeeded` });
                        } else {
                            sendEvent('warning', { message: `  ✗ ${tc.name}: ${result.error}` });
                        }

                        messages.push({
                            role: 'tool',
                            content: JSON.stringify(result.data ?? { error: result.error }),
                            toolCallId: tc.id,
                        });
                    }
                } else {
                    finalOutput = response.content;
                    break;
                }
            }

            sendEvent('done', { result: finalOutput });
            res.end();
        } catch (err) {
            sendEvent('error', { message: (err as Error).message });
            res.end();
        }
    });

    // ═══════════════════════════════════════════════
    // SERVE FRONTEND
    // ═══════════════════════════════════════════════
    // Resolve relative to the package root (dist/src/server/app.js -> ../../.. -> package root)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgRoot = resolve(__dirname, '..', '..', '..');
    const reactAppPath = resolve(pkgRoot, 'studio', 'dist');
    app.use(express.static(reactAppPath));
    app.use((_req, res) => { res.sendFile(resolve(reactAppPath, 'index.html')); });

    return server;
}
