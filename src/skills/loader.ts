import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { SkillManifestSchema, type LoadedSkill, type SkillManifest } from './types.js';
import { validateSchema } from '../utils/schema.js';
import { getSkillsDir } from '../utils/paths.js';
import type { AgentConfig } from '../config/schema.js';

/**
 * Skill loader — discovers, validates, and loads skills
 */
export class SkillLoader {
    private skills: Map<string, LoadedSkill> = new Map();
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    /**
     * Discover and load all skills from configured paths
     */
    async loadAll(): Promise<LoadedSkill[]> {
        this.skills.clear();
        const paths = this.config.skills.installPaths;
        const cwd = process.cwd();

        for (const skillPath of paths) {
            const absPath = path.resolve(cwd, skillPath);
            await this.loadFromDirectory(absPath);
        }

        return Array.from(this.skills.values());
    }

    /**
     * Load skills from a directory
     */
    private async loadFromDirectory(dirPath: string): Promise<void> {
        try {
            await access(dirPath);
        } catch {
            return; // Directory doesn't exist
        }

        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillDir = path.join(dirPath, entry.name);
            const manifestPath = path.join(skillDir, 'skill.json');

            try {
                await access(manifestPath);
                const skill = await this.loadSkill(skillDir);
                if (skill) {
                    this.skills.set(skill.manifest.name, skill);
                }
            } catch {
                // Skip directories without skill.json
            }
        }
    }

    /**
     * Load a single skill from its directory
     */
    async loadSkill(skillDir: string): Promise<LoadedSkill | null> {
        const manifestPath = path.join(skillDir, 'skill.json');

        try {
            const content = await readFile(manifestPath, 'utf-8');
            const raw = JSON.parse(content);

            const result = validateSchema(SkillManifestSchema, raw, `skill.json in ${path.basename(skillDir)}`);
            if (!result.success) {
                console.error(`Invalid skill manifest at ${manifestPath}:\n${result.errors.join('\n')}`);
                return null;
            }

            const manifest = result.data as SkillManifest;

            // Lockfile verification
            const { LockfileManager } = await import('../hub/lockfile.js');
            const locker = new LockfileManager(process.cwd());
            const verification = await locker.verifyDirectory('skill', manifest.name, skillDir);
            if (!verification.valid) {
                console.error(`\n🚨 SECURITY WARNING: Skill "${manifest.name}" failed integrity check!`);
                verification.errors.forEach(e => console.error(`   - ${e}`));
                console.error(`   Refusing to load tampered skill.\n`);
                return null;
            }

            const loaded: LoadedSkill = {
                manifest,
                path: skillDir,
            };

            // Load entrypoint content
            const entryPath = path.join(skillDir, manifest.entrypoint);
            if (manifest.entrypoint.endsWith('.md')) {
                loaded.promptContent = await readFile(entryPath, 'utf-8');
            } else if (manifest.entrypoint.endsWith('.ts') || manifest.entrypoint.endsWith('.js')) {
                loaded.workflowPath = entryPath;
            }

            return loaded;
        } catch (err) {
            console.error(`Failed to load skill from ${skillDir}: ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Get a loaded skill by name
     */
    get(name: string): LoadedSkill | undefined {
        return this.skills.get(name);
    }

    /**
     * List all loaded skills
     */
    list(): LoadedSkill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Check if a skill exists
     */
    has(name: string): boolean {
        return this.skills.has(name);
    }

    /**
     * Install a skill from a local path
     */
    async installFromPath(sourcePath: string, targetDir?: string): Promise<LoadedSkill | null> {
        const destDir = targetDir ?? getSkillsDir();
        const absSource = path.resolve(sourcePath);

        // Validate the skill first
        const skill = await this.loadSkill(absSource);
        if (!skill) {
            throw new Error(`Invalid skill at ${absSource}`);
        }

        // Copy to target directory
        const targetPath = path.join(destDir, skill.manifest.name);
        const { cpSync } = await import('node:fs');
        cpSync(absSource, targetPath, { recursive: true });

        // Reload
        const installed = await this.loadSkill(targetPath);
        if (installed) {
            this.skills.set(installed.manifest.name, installed);
        }
        return installed;
    }

    /**
     * Reload a specific skill from disk
     */
    async reload(name: string): Promise<LoadedSkill | null> {
        const skill = this.skills.get(name);
        if (!skill) return null;

        const reloaded = await this.loadSkill(skill.path);
        if (reloaded) {
            this.skills.set(name, reloaded);
        }
        return reloaded;
    }

    /**
     * Remove a skill
     */
    async remove(name: string): Promise<boolean> {
        const skill = this.skills.get(name);
        if (!skill) return false;

        const { rmSync } = await import('node:fs');
        rmSync(skill.path, { recursive: true, force: true });
        this.skills.delete(name);
        return true;
    }
}
