import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export interface LockfileEntry {
    version: string;
    resolved: string;
    integrity: Record<string, string>;
}

export interface AgentLockfile {
    lockfileVersion: number;
    skills: Record<string, LockfileEntry>;
    plugins: Record<string, LockfileEntry>;
}

/**
 * Manages supply-chain security by tracking hashes of installed capabilities
 */
export class LockfileManager {
    private lockfilePath: string;

    constructor(projectRoot: string) {
        this.lockfilePath = path.join(projectRoot, '.agent', 'agent-lock.json');
    }

    async read(): Promise<AgentLockfile> {
        try {
            const content = await readFile(this.lockfilePath, 'utf-8');
            return JSON.parse(content) as AgentLockfile;
        } catch {
            return {
                lockfileVersion: 1,
                skills: {},
                plugins: {}
            };
        }
    }

    async write(lockfile: AgentLockfile): Promise<void> {
        await writeFile(this.lockfilePath, JSON.stringify(lockfile, null, 2) + '\n', 'utf-8');
    }

    static async hashFile(filePath: string): Promise<string> {
        const content = await readFile(filePath);
        return createHash('sha256').update(content).digest('hex');
    }

    async addEntry(
        type: 'skill' | 'plugin',
        name: string,
        version: string,
        resolvedUrl: string,
        files: { path: string; content: string | Buffer }[]
    ): Promise<void> {
        const lockfile = await this.read();

        const integrity: Record<string, string> = {};
        for (const file of files) {
            integrity[file.path] = createHash('sha256').update(file.content).digest('hex');
        }

        const dict = type === 'skill' ? lockfile.skills : lockfile.plugins;
        dict[name] = {
            version,
            resolved: resolvedUrl,
            integrity
        };

        await this.write(lockfile);
    }

    async verifyDirectory(
        type: 'skill' | 'plugin',
        name: string,
        dirPath: string
    ): Promise<{ valid: boolean; errors: string[] }> {
        const lockfile = await this.read();
        const dict = type === 'skill' ? lockfile.skills : lockfile.plugins;
        const entry = dict[name];

        if (!entry) {
            // Not managed by hub lockfile (e.g. locally authored custom skill)
            return { valid: true, errors: [] };
        }

        const errors: string[] = [];
        for (const [relPath, expectedHash] of Object.entries(entry.integrity)) {
            try {
                const actualHash = await LockfileManager.hashFile(path.join(dirPath, relPath));
                if (actualHash !== expectedHash) {
                    errors.push(`Integrity mismatch for ${type} "${name}": file "${relPath}" has been modified / tampered (expected ${expectedHash.substring(0, 8)}, got ${actualHash.substring(0, 8)})`);
                }
            } catch {
                errors.push(`Missing locked file for ${type} "${name}": "${relPath}" could not be read.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
