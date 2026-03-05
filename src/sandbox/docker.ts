// ─── Docker Client ───
// Lightweight Docker Engine API client using fetch over Unix socket.
// No npm dependencies — talks directly to /var/run/docker.sock.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ContainerState, SandboxMount } from './types.js';

const execFileAsync = promisify(execFile);

export class DockerClient {
    /**
     * Check if Docker is available on the system.
     */
    async isAvailable(): Promise<boolean> {
        try {
            await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], {
                timeout: 5000,
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Pull a Docker image if not already present.
     */
    async pullImage(image: string): Promise<void> {
        try {
            // Check if image exists locally
            await execFileAsync('docker', ['image', 'inspect', image], { timeout: 5000 });
        } catch {
            // Image not found locally — pull it
            await execFileAsync('docker', ['pull', image], {
                timeout: 120000, // 2 min for large images
            });
        }
    }

    /**
     * Create and start a new container.
     */
    async createContainer(options: {
        name: string;
        image: string;
        mounts: SandboxMount[];
        network: string;
        projectRoot: string;
    }): Promise<ContainerState> {
        const args = [
            'run', '-d',
            '--name', options.name,
            '--network', options.network,
            '--workdir', '/project',
            // Keep the container alive with a sleep process
            '--entrypoint', 'tail',
        ];

        // Add volume mounts
        for (const mount of options.mounts) {
            const hostPath = mount.hostPath === '.'
                ? options.projectRoot
                : mount.hostPath;
            const flag = mount.readOnly ? ':ro' : '';
            args.push('-v', `${hostPath}:${mount.containerPath}${flag}`);
        }

        args.push(options.image, '-f', '/dev/null');

        const { stdout } = await execFileAsync('docker', args, {
            timeout: 30000,
        });

        const containerId = stdout.trim();

        return {
            containerId,
            name: options.name,
            running: true,
            image: options.image,
            createdAt: new Date(),
        };
    }

    /**
     * Execute a command inside a running container.
     */
    async exec(
        containerId: string,
        command: string,
        cmdArgs: string[] = [],
        options: {
            cwd?: string;
            timeout?: number;
            env?: Record<string, string>;
        } = {},
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const args = ['exec'];

        // Working directory
        if (options.cwd) {
            args.push('-w', options.cwd);
        }

        // Environment variables
        if (options.env) {
            for (const [key, val] of Object.entries(options.env)) {
                args.push('-e', `${key}=${val}`);
            }
        }

        args.push(containerId, command, ...cmdArgs);

        try {
            const { stdout, stderr } = await execFileAsync('docker', args, {
                timeout: options.timeout || 30000,
                maxBuffer: 10 * 1024 * 1024,
                shell: true,
            });
            return { stdout: stdout.toString(), stderr: stderr.toString(), exitCode: 0 };
        } catch (err) {
            const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
            return {
                stdout: error.stdout?.toString() ?? '',
                stderr: error.stderr?.toString() ?? error.message ?? '',
                exitCode: error.code ?? 1,
            };
        }
    }

    /**
     * Check if a container is running.
     */
    async isRunning(containerId: string): Promise<boolean> {
        try {
            const { stdout } = await execFileAsync('docker', [
                'inspect', '--format', '{{.State.Running}}', containerId,
            ], { timeout: 5000 });
            return stdout.trim() === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Stop and remove a container.
     */
    async destroyContainer(containerId: string): Promise<void> {
        try {
            await execFileAsync('docker', ['rm', '-f', containerId], {
                timeout: 10000,
            });
        } catch {
            // Container may already be gone — ignore
        }
    }
}
