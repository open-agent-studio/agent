import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LockfileManager } from './lockfile.js';
import { getSkillsDir, getPluginsDir } from '../utils/paths.js';

export interface RegistryConfig {
    skillsUrl?: string;
    pluginsUrl?: string;
}

export interface RegistryItem {
    name: string;
    version: string;
    description: string;
    author: string;
    category: string;
    tags: string[];
    path: string;
    tools?: string[];
    permissions?: string[];
    files?: string[];
}

export interface Registry {
    version: number;
    name: string;
    description?: string;
    skills?: RegistryItem[];
    plugins?: RegistryItem[];
}

/**
 * RegistryClient - Handles remote skill and plugin installation and publishing
 */
export class RegistryClient {
    private skillsUrl: string;
    private pluginsUrl: string;

    constructor(config?: RegistryConfig) {
        this.skillsUrl = config?.skillsUrl ?? 'https://raw.githubusercontent.com/praveencs87/agent-skills/main';
        // We are using the exact same repo for plugins now, just a different top-level folder
        this.pluginsUrl = config?.pluginsUrl ?? 'https://raw.githubusercontent.com/praveencs87/agent-skills/main';
    }

    public async fetchJson(url: string): Promise<any> {
        const mod = url.startsWith('https') ? await import('node:https') : await import('node:http');
        return new Promise((resolve, reject) => {
            mod.default.get(url, (res: any) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.fetchJson(res.headers.location).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`Invalid JSON from ${url}`)); }
                });
                res.on('error', reject);
            }).on('error', reject);
        });
    }

    public async fetchText(url: string): Promise<string> {
        const mod = url.startsWith('https') ? await import('node:https') : await import('node:http');
        return new Promise((resolve, reject) => {
            mod.default.get(url, (res: any) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.fetchText(res.headers.location).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }).on('error', reject);
        });
    }

    async getCatalog(type: 'skill' | 'plugin'): Promise<Registry> {
        const url = type === 'skill' ? this.skillsUrl : this.pluginsUrl;
        return this.fetchJson(`${url}/registry.json`);
    }

    async search(type: 'skill' | 'plugin', query: string, category?: string): Promise<RegistryItem[]> {
        const registry = await this.getCatalog(type);
        const items = type === 'skill' ? (registry.skills || []) : (registry.plugins || []);

        if (!query && !category) return items;

        const q = (query || '').toLowerCase();
        const c = (category || '').toLowerCase();

        return items.filter(s => {
            const matchName = s.name.toLowerCase().includes(q);
            const matchDesc = s.description.toLowerCase().includes(q);
            const matchTags = (s.tags || []).some(t => t.toLowerCase().includes(q));

            const matchQuery = q ? (matchName || matchDesc || matchTags) : true;
            const matchCat = c ? (s.category || '').toLowerCase().includes(c) : true;

            return matchQuery && matchCat;
        });
    }

    async install(type: 'skill' | 'plugin', name: string, projectRoot: string): Promise<{ item: RegistryItem, destPath: string }> {
        const registry = await this.getCatalog(type);
        const baseUrl = type === 'skill' ? this.skillsUrl : this.pluginsUrl;
        const items = type === 'skill' ? (registry.skills || []) : (registry.plugins || []);

        const item = items.find(s => s.name === name);
        if (!item) {
            throw new Error(`${type} "${name}" not found in the registry.`);
        }

        const baseDestDir = type === 'skill' ? getSkillsDir(projectRoot) : getPluginsDir(projectRoot);
        const destDir = path.join(baseDestDir, name);
        await mkdir(destDir, { recursive: true });

        const downloadedFiles: { path: string; content: string }[] = [];

        if (type === 'skill') {
            const manifestUrl = `${baseUrl}/${item.path}/skill.json`;
            const manifest = await this.fetchJson(manifestUrl);
            const entrypoint = manifest.entrypoint || 'prompt.md';
            const promptUrl = `${baseUrl}/${item.path}/${entrypoint}`;
            const promptContent = await this.fetchText(promptUrl);

            downloadedFiles.push({ path: 'skill.json', content: JSON.stringify(manifest, null, 2) + '\n' });
            downloadedFiles.push({ path: entrypoint, content: promptContent });

            if (name === 'send-email') {
                try {
                    const sendJs = await this.fetchText(`${baseUrl}/${item.path}/send.js`);
                    downloadedFiles.push({ path: 'send.js', content: sendJs });
                } catch { /* ignore */ }
            }
        } else {
            const filesToDownload = item.files || ['plugin.json'];
            for (const file of filesToDownload) {
                const fileUrl = `${baseUrl}/${item.path}/${file}`;
                const fileContent = await this.fetchText(fileUrl);
                downloadedFiles.push({ path: file, content: fileContent });
            }
        }

        // Write all files correctly resolving nested paths
        for (const file of downloadedFiles) {
            const filePath = path.join(destDir, ...file.path.split('/'));
            await mkdir(path.dirname(filePath), { recursive: true });
            await writeFile(filePath, file.content, 'utf-8');
        }

        // Lockfile update
        const locker = new LockfileManager(projectRoot);
        await locker.addEntry(type, name, item.version, `${baseUrl}/${item.path}`, downloadedFiles);

        return { item, destPath: destDir };
    }
}
