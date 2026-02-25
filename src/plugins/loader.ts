import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import type { PluginManifest, LoadedPlugin } from './types.js';
import type { SkillLoader } from '../skills/loader.js';
import type { CommandLoader } from '../commands/loader.js';
import type { HookRegistry } from '../hooks/registry.js';
import type { ScriptLoader } from '../scripts/loader.js';

/**
 * Plugin Loader — discovers, validates, and loads plugin bundles
 *
 * A plugin is a directory containing a `.agent-plugin/plugin.json`
 * manifest that references skills, commands, hooks within the plugin.
 *
 * Plugins are loaded from `.agent/plugins/` by default.
 */
export class PluginLoader {
    private plugins: Map<string, LoadedPlugin> = new Map();

    /**
     * Load all plugins from configured install paths
     */
    async loadAll(
        installPaths: string[],
        projectRoot: string,
        skillLoader: SkillLoader,
        commandLoader: CommandLoader,
        hookRegistry: HookRegistry,
        scriptLoader?: ScriptLoader
    ): Promise<LoadedPlugin[]> {
        this.plugins.clear();

        for (const pluginPath of installPaths) {
            const absPath = path.resolve(projectRoot, pluginPath);
            await this.loadFromDirectory(absPath, skillLoader, commandLoader, hookRegistry, scriptLoader);
        }

        return Array.from(this.plugins.values());
    }

    /**
     * Load plugins from a directory
     */
    private async loadFromDirectory(
        dirPath: string,
        skillLoader: SkillLoader,
        commandLoader: CommandLoader,
        hookRegistry: HookRegistry,
        scriptLoader?: ScriptLoader
    ): Promise<void> {
        try {
            await access(dirPath);
        } catch {
            return; // Directory doesn't exist
        }

        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginDir = path.join(dirPath, entry.name);
            await this.loadPlugin(pluginDir, skillLoader, commandLoader, hookRegistry, scriptLoader);
        }
    }

    /**
     * Load a single plugin
     */
    async loadPlugin(
        pluginDir: string,
        skillLoader: SkillLoader,
        commandLoader: CommandLoader,
        hookRegistry: HookRegistry,
        scriptLoader?: ScriptLoader
    ): Promise<LoadedPlugin | null> {
        // Look for manifest in .agent-plugin/ or root
        let manifestPath = path.join(pluginDir, '.agent-plugin', 'plugin.json');
        try {
            await access(manifestPath);
        } catch {
            // Fall back to root plugin.json
            manifestPath = path.join(pluginDir, 'plugin.json');
            try {
                await access(manifestPath);
            } catch {
                return null; // No manifest found
            }
        }

        try {
            const content = await readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(content);

            if (!manifest.name || !manifest.version) {
                console.error(`Invalid plugin manifest at ${manifestPath}: missing name or version`);
                return null;
            }

            let skillsCount = 0;
            let commandsCount = 0;
            let hooksCount = 0;
            let scriptsCount = 0;

            // Load skills from plugin
            if (manifest.skills) {
                for (const skillDir of manifest.skills) {
                    const absSkillDir = path.resolve(pluginDir, skillDir);
                    try {
                        const entries = await readdir(absSkillDir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (!entry.isDirectory()) continue;
                            const skill = await skillLoader.loadSkill(path.join(absSkillDir, entry.name));
                            if (skill) {
                                (skillLoader as any).skills.set(skill.manifest.name, skill);
                                skillsCount++;
                            }
                        }
                    } catch {
                        // Skill directory doesn't exist or can't be read
                    }
                }
            }

            // Load commands from plugin
            if (manifest.commands) {
                for (const cmdDir of manifest.commands) {
                    const absCmdDir = path.resolve(pluginDir, cmdDir);
                    commandsCount += await commandLoader.loadFromDirectory(absCmdDir, manifest.name);
                }
            }

            // Load hooks from plugin
            if (manifest.hooks) {
                const hooksPath = path.resolve(pluginDir, manifest.hooks);
                hooksCount = await hookRegistry.loadFromFile(hooksPath, manifest.name);
            }

            // Load scripts from plugin
            if (manifest.scripts && scriptLoader) {
                for (const scriptDir of manifest.scripts) {
                    const absScriptDir = path.resolve(pluginDir, scriptDir);
                    scriptsCount += await scriptLoader.loadFromDirectory(absScriptDir, manifest.name);
                }
            }

            const loaded: LoadedPlugin = {
                manifest,
                path: pluginDir,
                skillsCount,
                commandsCount,
                hooksCount,
                scriptsCount,
            };

            this.plugins.set(manifest.name, loaded);
            return loaded;
        } catch (err) {
            console.error(`Failed to load plugin from ${pluginDir}: ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * List all loaded plugins
     */
    list(): LoadedPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get a plugin by name
     */
    get(name: string): LoadedPlugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * Get total count
     */
    get size(): number {
        return this.plugins.size;
    }
}
