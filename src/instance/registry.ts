import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface AgentInstance {
    id: string;
    pid: number;
    cwd: string;
    port: number; // Server port if any
    status: 'idle' | 'running' | 'offline';
    lastSeen: number;
    project?: string; // Optional name from package.json
}

export class InstanceRegistry {
    private registryPath: string;

    constructor() {
        this.registryPath = resolve(homedir(), '.agent-runtime', 'instances.json');
    }

    private async ensureDir() {
        const dir = resolve(homedir(), '.agent-runtime');
        await mkdir(dir, { recursive: true });
    }

    private async readRegistry(): Promise<AgentInstance[]> {
        try {
            await this.ensureDir();
            const raw = await readFile(this.registryPath, 'utf-8');
            return JSON.parse(raw) as AgentInstance[];
        } catch {
            return [];
        }
    }

    private async writeRegistry(instances: AgentInstance[]) {
        await this.ensureDir();
        await writeFile(this.registryPath, JSON.stringify(instances, null, 2));
    }

    async register(instance: Omit<AgentInstance, 'lastSeen'>) {
        let instances = await this.readRegistry();

        // Remove stale/same pid
        instances = instances.filter(i => this.isProcessAlive(i.pid) && i.id !== instance.id);

        instances.push({
            ...instance,
            lastSeen: Date.now()
        });

        await this.writeRegistry(instances);
    }

    async unregister(id: string) {
        let instances = await this.readRegistry();
        instances = instances.filter(i => i.id !== id);
        await this.writeRegistry(instances);
    }

    async heartbeat(id: string, status?: AgentInstance['status']) {
        let instances = await this.readRegistry();
        let found = false;

        for (const i of instances) {
            if (i.id === id) {
                i.lastSeen = Date.now();
                if (status) i.status = status;
                found = true;
                break;
            }
        }

        if (found) {
            await this.writeRegistry(instances);
        }
    }

    async listActive(): Promise<AgentInstance[]> {
        const instances = await this.readRegistry();
        const active = instances.filter(i => this.isProcessAlive(i.pid));

        if (active.length !== instances.length) {
            await this.writeRegistry(active); // clean up zombies
        }

        return active;
    }

    private isProcessAlive(pid: number): boolean {
        try {
            // Note: kill(pid, 0) does not actually kill the process but checks if it exists
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }
}
