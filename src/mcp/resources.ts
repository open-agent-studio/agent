import { MemoryStore } from '../memory/store.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export class McpResourceManager {
    private memStore: MemoryStore;

    constructor() {
        this.memStore = MemoryStore.open(process.cwd());
    }

    async getResourceTemplates() {
        return [
            {
                uriTemplate: "file://{path}",
                name: "Workspace File",
                description: "Read a file from the current agent workspace"
            },
            {
                uriTemplate: "memory://{category}",
                name: "Agent Memories by Category",
                description: "Read agent memories (knowledge, facts, project info) by category"
            }
        ];
    }

    async listResources() {
        const resources = [];
        try {
            const files = await readdir(process.cwd());
            for (const file of files) {
                if (file.startsWith('.')) continue; // skip hidden
                const s = await stat(join(process.cwd(), file));
                if (s.isFile()) {
                    resources.push({
                        uri: `file://${file}`,
                        name: file,
                        mimeType: 'text/plain',
                    });
                }
            }
        } catch { }

        resources.push({
            uri: 'memory://all',
            name: 'All Agent Memories',
            mimeType: 'application/json'
        });

        return resources;
    }

    async readResource(uri: string) {
        if (uri.startsWith('file://')) {
            const path = uri.replace('file://', '');
            try {
                const content = await readFile(join(process.cwd(), path), 'utf-8');
                return {
                    contents: [{
                        uri,
                        mimeType: 'text/plain',
                        text: content
                    }]
                };
            } catch (err) {
                throw new Error(`Failed to read file: ${(err as Error).message}`);
            }
        }

        if (uri.startsWith('memory://')) {
            const category = uri.replace('memory://', '');
            const memories = category === 'all'
                ? this.memStore.list()
                : this.memStore.list(category as any);

            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(memories, null, 2)
                }]
            };
        }

        throw new Error(`Unsupported resource URI: ${uri}`);
    }
}
