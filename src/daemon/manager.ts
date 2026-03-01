import { readFile, writeFile, access, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import { getAgentDir } from '../utils/paths.js';

/**
 * Daemon manager — start/stop/status for the agent daemon process
 */
export class DaemonManager {
    private pidFile: string;
    private logFile: string;
    private cwd: string;

    constructor(cwd: string = process.cwd()) {
        this.cwd = cwd;
        this.pidFile = path.join(getAgentDir(cwd), 'daemon.pid');
        this.logFile = path.join(getAgentDir(cwd), 'daemon.log');
    }

    /**
     * Start the daemon as a detached background process
     */
    async start(): Promise<{ pid: number; message: string }> {
        // Check if already running
        const existing = await this.status();
        if (existing.running) {
            return { pid: existing.pid!, message: `Daemon already running (PID: ${existing.pid})` };
        }

        // Ensure .agent dir exists
        await mkdir(path.dirname(this.pidFile), { recursive: true });

        // Resolve to the compiled service.js
        const daemonScript = path.resolve(
            path.dirname(new URL(import.meta.url).pathname),
            'service.js'
        );

        // Fork the daemon process
        const child: ChildProcess = fork(daemonScript, [], {
            detached: true,
            stdio: 'ignore',
            cwd: this.cwd,
            env: {
                ...process.env,
                AGENT_DAEMON: '1',
                AGENT_WORK_DIR: this.cwd,
            },
        });

        child.unref();

        const pid = child.pid!;
        await writeFile(this.pidFile, String(pid), 'utf-8');

        return { pid, message: `Daemon started (PID: ${pid})` };
    }

    /**
     * Stop the daemon gracefully
     */
    async stop(): Promise<{ message: string }> {
        const status = await this.status();
        if (!status.running || !status.pid) {
            return { message: 'Daemon is not running' };
        }

        try {
            process.kill(status.pid, 'SIGTERM');
            await unlink(this.pidFile).catch(() => { });
            return { message: `Daemon stopped (PID: ${status.pid})` };
        } catch (err) {
            return { message: `Failed to stop daemon: ${(err as Error).message}` };
        }
    }

    /**
     * Get daemon status
     */
    async status(): Promise<{
        running: boolean;
        pid?: number;
        uptime?: string;
    }> {
        try {
            await access(this.pidFile);
            const pidStr = await readFile(this.pidFile, 'utf-8');
            const pid = parseInt(pidStr.trim(), 10);

            // Check if process is alive
            try {
                process.kill(pid, 0);
                return { running: true, pid };
            } catch {
                // PID file exists but process is dead — clean up
                await unlink(this.pidFile).catch(() => { });
                return { running: false };
            }
        } catch {
            return { running: false };
        }
    }

    /**
     * Get recent daemon log lines
     */
    async getLogs(lines = 30): Promise<string[]> {
        try {
            const content = await readFile(this.logFile, 'utf-8');
            const allLines = content.split('\n').filter(l => l.trim());
            return allLines.slice(-lines);
        } catch {
            return ['No daemon logs found.'];
        }
    }
}
