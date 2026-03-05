// ─── Sandbox Engine ───
// Manages the lifecycle of sandboxed execution containers.
// When enabled, all cmd.run calls are routed through the sandbox.

import { DockerClient } from './docker.js';
import type { SandboxConfig, ContainerState, SandboxExecResult } from './types.js';
import { DEFAULT_SANDBOX_CONFIG } from './types.js';

export class SandboxEngine {
    private docker: DockerClient;
    private config: SandboxConfig;
    private container: ContainerState | null = null;
    private projectRoot: string;

    constructor(projectRoot: string, config?: Partial<SandboxConfig>) {
        this.docker = new DockerClient();
        this.projectRoot = projectRoot;
        this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    }

    /** Whether sandbox mode is enabled */
    get enabled(): boolean {
        return this.config.enabled;
    }

    /** Whether the sandbox container is currently running */
    get isActive(): boolean {
        return this.container !== null && this.container.running;
    }

    /** Current container info */
    get containerInfo(): ContainerState | null {
        return this.container;
    }

    /**
     * Start the sandbox: pull image, create container.
     * Call this when the daemon starts or when the user runs `agent sandbox start`.
     */
    async start(): Promise<ContainerState> {
        // Check Docker availability
        const available = await this.docker.isAvailable();
        if (!available) {
            throw new Error(
                'Docker is not available. Install Docker from https://docs.docker.com/get-docker/ or disable sandbox in config.'
            );
        }

        // Pull image if needed
        await this.docker.pullImage(this.config.image);

        // Destroy any existing sandbox container
        const containerName = `agent-sandbox-${Date.now()}`;
        try {
            await this.docker.destroyContainer('agent-sandbox');
        } catch { /* ignore */ }

        // Create the container
        this.container = await this.docker.createContainer({
            name: containerName,
            image: this.config.image,
            mounts: this.config.mounts,
            network: this.config.network,
            projectRoot: this.projectRoot,
        });

        return this.container;
    }

    /**
     * Execute a command inside the sandbox.
     * This is the main entry point used by cmd.run when sandbox is enabled.
     */
    async exec(
        command: string,
        args: string[] = [],
        options: {
            cwd?: string;
            timeout?: number;
            env?: Record<string, string>;
        } = {},
    ): Promise<SandboxExecResult> {
        if (!this.container) {
            throw new Error('Sandbox is not running. Call start() first or enable auto-start in config.');
        }

        // Verify container is still running
        const running = await this.docker.isRunning(this.container.containerId);
        if (!running) {
            this.container.running = false;
            throw new Error('Sandbox container has stopped unexpectedly. Restart with `agent sandbox start`.');
        }

        // Map the host cwd to the container path
        const containerCwd = options.cwd
            ? this.mapHostPathToContainer(options.cwd)
            : '/project';

        return await this.docker.exec(
            this.container.containerId,
            command,
            args,
            {
                cwd: containerCwd,
                timeout: options.timeout || this.config.timeout,
                env: options.env,
            },
        );
    }

    /**
     * Stop and destroy the sandbox container.
     */
    async stop(): Promise<void> {
        if (this.container) {
            await this.docker.destroyContainer(this.container.containerId);
            this.container = null;
        }
    }

    /**
     * Get sandbox status for CLI/Studio display.
     */
    async status(): Promise<{
        enabled: boolean;
        running: boolean;
        image: string;
        containerId?: string;
        uptime?: number;
    }> {
        const running = this.container
            ? await this.docker.isRunning(this.container.containerId)
            : false;

        return {
            enabled: this.config.enabled,
            running,
            image: this.config.image,
            containerId: this.container?.containerId,
            uptime: this.container
                ? Date.now() - this.container.createdAt.getTime()
                : undefined,
        };
    }

    /**
     * Map a host filesystem path to the equivalent container path
     * based on the configured volume mounts.
     */
    private mapHostPathToContainer(hostPath: string): string {
        for (const mount of this.config.mounts) {
            const resolvedHost = mount.hostPath === '.'
                ? this.projectRoot
                : mount.hostPath;

            if (hostPath.startsWith(resolvedHost)) {
                const relative = hostPath.slice(resolvedHost.length);
                return mount.containerPath + relative;
            }
        }

        // If no mount matches, use /project as default
        return '/project';
    }
}

// ─── Singleton instance ───
let sandboxInstance: SandboxEngine | null = null;

export function getSandboxEngine(): SandboxEngine | null {
    return sandboxInstance;
}

export function initSandboxEngine(projectRoot: string, config?: Partial<SandboxConfig>): SandboxEngine {
    sandboxInstance = new SandboxEngine(projectRoot, config);
    return sandboxInstance;
}
