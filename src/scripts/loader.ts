import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { ScriptManifestSchema, type ScriptManifest, type LoadedScript } from './types.js';
import { validateSchema } from '../utils/schema.js';

/**
 * Script Loader — discovers, validates, and loads scripts
 *
 * Scripts are directories containing a `script.yaml` manifest and an
 * entrypoint file (shell, Node, Python, etc.).
 *
 * Default location: `.agent/scripts/`
 * Also loaded from plugins via `plugin.json` → `scripts` field.
 */
export class ScriptLoader {
    private scripts: Map<string, LoadedScript> = new Map();

    /**
     * Load scripts from all configured install paths
     */
    async loadAll(installPaths: string[], projectRoot: string): Promise<LoadedScript[]> {
        this.scripts.clear();

        for (const scriptPath of installPaths) {
            const absPath = path.resolve(projectRoot, scriptPath);
            await this.loadFromDirectory(absPath, 'project');
        }

        return Array.from(this.scripts.values());
    }

    /**
     * Load scripts from the default project location (.agent/scripts/)
     */
    async loadProjectScripts(projectRoot: string): Promise<number> {
        const scriptsDir = path.join(projectRoot, '.agent', 'scripts');
        return this.loadFromDirectory(scriptsDir, 'project');
    }

    /**
     * Load scripts from a directory
     */
    async loadFromDirectory(dirPath: string, source = 'project'): Promise<number> {
        try {
            await access(dirPath);
        } catch {
            return 0; // Directory doesn't exist
        }

        const entries = await readdir(dirPath, { withFileTypes: true });
        let count = 0;

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const scriptDir = path.join(dirPath, entry.name);
            const script = await this.loadScript(scriptDir, source);
            if (script) {
                this.scripts.set(script.manifest.name, script);
                count++;
            }
        }

        return count;
    }

    /**
     * Load a single script from its directory
     */
    async loadScript(scriptDir: string, source = 'project'): Promise<LoadedScript | null> {
        // Try script.yaml first, then script.yml, then script.json
        let manifestPath: string | null = null;
        for (const filename of ['script.yaml', 'script.yml', 'script.json']) {
            const candidate = path.join(scriptDir, filename);
            try {
                await access(candidate);
                manifestPath = candidate;
                break;
            } catch {
                // Try next
            }
        }

        if (!manifestPath) {
            return null; // No manifest found
        }

        try {
            const content = await readFile(manifestPath, 'utf-8');
            let raw: unknown;

            if (manifestPath.endsWith('.json')) {
                raw = JSON.parse(content);
            } else {
                // Simple YAML parser for flat structures
                raw = this.parseSimpleYaml(content);
            }

            const result = validateSchema(
                ScriptManifestSchema,
                raw,
                `script manifest in ${path.basename(scriptDir)}`
            );

            if (!result.success) {
                console.error(`Invalid script manifest at ${manifestPath}:\n${result.errors.join('\n')}`);
                return null;
            }

            const manifest = result.data as ScriptManifest;
            const entrypointPath = path.resolve(scriptDir, manifest.entrypoint);

            // Verify entrypoint exists
            try {
                await access(entrypointPath);
            } catch {
                console.error(`Script entrypoint not found: ${entrypointPath}`);
                return null;
            }

            return {
                manifest,
                path: scriptDir,
                entrypointPath,
                source,
            };
        } catch (err) {
            console.error(`Failed to load script from ${scriptDir}: ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Simple YAML parser — handles flat key: value, arrays, and nested objects
     */
    private parseSimpleYaml(content: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        const lines = content.split('\n');
        let currentKey: string | null = null;
        let currentObject: Record<string, unknown> | null = null;
        let currentSubKey: string | null = null;
        let currentSubObject: Record<string, unknown> | null = null;

        for (const line of lines) {
            // Skip comments and empty lines
            if (line.trim().startsWith('#') || line.trim() === '') continue;
            if (line.trim() === '---') continue;

            const indent = line.length - line.trimStart().length;

            if (indent === 0) {
                // Top-level key
                if (currentSubObject && currentSubKey && currentObject) {
                    currentObject[currentSubKey] = currentSubObject;
                    currentSubObject = null;
                    currentSubKey = null;
                }
                if (currentObject && currentKey) {
                    result[currentKey] = currentObject;
                    currentObject = null;
                }

                const colonIdx = line.indexOf(':');
                if (colonIdx === -1) continue;

                const key = line.slice(0, colonIdx).trim();
                const value = line.slice(colonIdx + 1).trim();

                if (value === '') {
                    // Start of a nested object or array
                    currentKey = key;
                    currentObject = {};
                } else {
                    result[key] = this.parseYamlValue(value);
                    currentKey = null;
                }
            } else if (indent >= 2 && indent < 4 && currentKey) {
                // First-level nesting
                if (currentSubObject && currentSubKey && currentObject) {
                    currentObject[currentSubKey] = currentSubObject;
                    currentSubObject = null;
                    currentSubKey = null;
                }

                const trimmed = line.trim();

                // Array item
                if (trimmed.startsWith('- ')) {
                    const item = trimmed.slice(2).trim();
                    if (!Array.isArray(currentObject)) {
                        if (currentKey) result[currentKey] = [];
                        currentObject = null;
                    }
                    const arr = result[currentKey!] as unknown[];
                    if (!Array.isArray(arr)) {
                        result[currentKey!] = [this.parseYamlValue(item)];
                    } else {
                        arr.push(this.parseYamlValue(item));
                    }
                    continue;
                }

                const colonIdx = trimmed.indexOf(':');
                if (colonIdx === -1) continue;

                const subKey = trimmed.slice(0, colonIdx).trim();
                const subValue = trimmed.slice(colonIdx + 1).trim();

                if (!currentObject || Array.isArray(currentObject)) {
                    currentObject = {};
                }

                if (subValue === '') {
                    currentSubKey = subKey;
                    currentSubObject = {};
                } else {
                    currentObject[subKey] = this.parseYamlValue(subValue);
                }
            } else if (indent >= 4 && currentSubKey && currentSubObject) {
                // Second-level nesting
                const trimmed = line.trim();
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx === -1) continue;

                const deepKey = trimmed.slice(0, colonIdx).trim();
                const deepValue = trimmed.slice(colonIdx + 1).trim();

                currentSubObject[deepKey] = this.parseYamlValue(deepValue);
            }
        }

        // Flush remaining
        if (currentSubObject && currentSubKey && currentObject && !Array.isArray(currentObject)) {
            currentObject[currentSubKey] = currentSubObject;
        }
        if (currentObject && currentKey && !Array.isArray(result[currentKey])) {
            result[currentKey] = currentObject;
        }

        return result;
    }

    /**
     * Parse a YAML scalar value
     */
    private parseYamlValue(value: string): unknown {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null' || value === '~') return null;

        // Number
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return Number(value);
        }

        // Inline array [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
            return value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        }

        // Strip quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }

        return value;
    }

    /**
     * Get a loaded script by name
     */
    get(name: string): LoadedScript | undefined {
        return this.scripts.get(name);
    }

    /**
     * Check if a script exists
     */
    has(name: string): boolean {
        return this.scripts.has(name);
    }

    /**
     * List all loaded scripts
     */
    list(): LoadedScript[] {
        return Array.from(this.scripts.values());
    }

    /**
     * Get count of loaded scripts
     */
    get size(): number {
        return this.scripts.size;
    }
}
