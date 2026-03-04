import path from 'node:path';
import { cp, readFile, writeFile, access } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getSkillsDir, getPluginsDir } from '../utils/paths.js';
import { validateSkill } from '../skills/validator.js';
import chalk from 'chalk';
import type { Registry, RegistryItem } from './registry.js';

const execAsync = promisify(exec);

export class Publisher {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Publish a local skill or plugin to the corresponding hub repository
     */
    async publish(type: 'skill' | 'plugin', name: string): Promise<void> {
        const sourceDir = type === 'skill'
            ? path.join(getSkillsDir(this.projectRoot), name)
            : path.join(getPluginsDir(this.projectRoot), name);

        // Check if local source exists
        try {
            await access(sourceDir);
        } catch {
            throw new Error(`Local ${type} "${name}" not found at ${sourceDir}`);
        }

        // Use agent-skills repository for BOTH skills and plugins
        const registryPath = path.resolve(this.projectRoot, '..', 'agent-skills');

        // Check if registry repo exists locally
        try {
            await access(registryPath);
        } catch {
            throw new Error(
                `Registry repository not found at ${registryPath}.\n` +
                `Please ensure you have cloned the agent-skills repository next to the Agent repository.`
            );
        }

        const destDir = type === 'skill'
            ? path.join(registryPath, 'skills', name)
            : path.join(registryPath, 'plugins', name);

        console.log(chalk.dim(`\n🚀 Preparing to publish ${type} "${name}"...`));

        // 1. Basic validation & Metadata Extraction
        let manifest: any;
        let entry: RegistryItem;

        if (type === 'skill') {
            const manifestPath = path.join(sourceDir, 'skill.json');
            manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

            // Validate using existing validator (requires LoadedSkill shape)
            const validation = await validateSkill({ manifest, path: sourceDir } as any);
            if (!validation.valid) {
                throw new Error(`Skill validation failed:\n  - ${validation.errors.join('\n  - ')}`);
            }

            entry = {
                name: manifest.name,
                version: manifest.version,
                description: manifest.description || '',
                author: manifest.author || 'Unknown',
                category: manifest.category || 'Uncategorized',
                tags: manifest.tags || [],
                path: `skills/${name}`,
                tools: manifest.tools || [],
                permissions: manifest.permissions?.required || []
            };
        } else {
            // Basic Plugin validation
            let manifestPath = path.join(sourceDir, '.agent-plugin', 'plugin.json');
            try {
                await access(manifestPath);
            } catch {
                manifestPath = path.join(sourceDir, 'plugin.json');
            }
            manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

            if (!manifest.name || !manifest.version) {
                throw new Error('Plugin manifest missing name or version.');
            }

            // Using standard git command to find all tracked files in the plugin dir to register them?
            // Actually, for simplicity we just define entry files based on git ls-files if it's a git repo,
            // or just copy everything and let the registry figure out files.
            // A hub needs to know which files to fetch. Usually, a publisher writes the 'files' array to registry.json
            const files = await this.listTrackedOrAllFiles(sourceDir);

            entry = {
                name: manifest.name,
                version: manifest.version,
                description: manifest.description || '',
                author: manifest.author || 'Unknown',
                category: manifest.category || 'Uncategorized',
                tags: manifest.tags || [],
                path: `plugins/${name}`,
                files
            };
        }

        // 2. Copy files to registry repository
        console.log(chalk.dim(`  Copying files to ${destDir}...`));
        await cp(sourceDir, destDir, { recursive: true, force: true });

        // 3. Update registry.json
        const registryJsonPath = path.join(registryPath, 'registry.json');
        const registryData: Registry = JSON.parse(await readFile(registryJsonPath, 'utf-8'));

        const list = type === 'skill' ? (registryData.skills || []) : (registryData.plugins || []);
        const existingIdx = list.findIndex(i => i.name === name);
        if (existingIdx >= 0) {
            list[existingIdx] = entry; // Update
        } else {
            list.push(entry); // Add newly
        }

        if (type === 'skill') registryData.skills = list;
        else registryData.plugins = list;

        await writeFile(registryJsonPath, JSON.stringify(registryData, null, 4) + '\n', 'utf-8');
        console.log(chalk.dim(`  Updated registry.json metadata.`));

        // 4. Git Commit & Push (Simulated as PR creation process)
        console.log(chalk.dim(`  Committing to git...`));
        try {
            await execAsync(`git add .`, { cwd: registryPath });
            const commitMsg = `feat(${type}): publish ${name} v${entry.version}`;
            await execAsync(`git commit -m "${commitMsg}"`, { cwd: registryPath });
            console.log(chalk.green(`✓ Successfully committed to local ${type} hub repository.`));
            console.log(chalk.dim(`  To finish publishing to the cloud, run 'git push' from that repository.\n`));
        } catch (err: any) {
            if (err.stdout?.includes('nothing to commit')) {
                console.log(chalk.yellow(`  No file changes detected. Nothing to commit.`));
            } else {
                throw err; // Real error
            }
        }
    }

    /**
     * Recursively list all files in a directory (ignoring node_modules/.git)
     */
    private async listTrackedOrAllFiles(dir: string): Promise<string[]> {
        // Find files using a basic recursive readdir implementation via node
        const results: string[] = [];
        const { readdir } = await import('node:fs/promises');

        async function walk(currentDir: string, basePath: string) {
            const entries = await readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.join(basePath, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath, relPath);
                } else {
                    // Normalize to forward slashes for registry map
                    results.push(relPath.replace(/\\/g, '/'));
                }
            }
        }
        await walk(dir, '');
        return results;
    }
}
