// ─── Sandbox Types ───

export interface SandboxConfig {
    /** Enable sandboxed execution */
    enabled: boolean;
    /** Docker image to use (default: node:20-slim) */
    image: string;
    /** Max execution time per command (ms) */
    timeout: number;
    /** Volume mounts from host to container */
    mounts: SandboxMount[];
    /** Network mode: 'bridge' | 'host' | 'none' */
    network: string;
    /** Auto-remove container on daemon stop */
    autoDestroy: boolean;
}

export interface SandboxMount {
    /** Host path (relative to project root or absolute) */
    hostPath: string;
    /** Container path */
    containerPath: string;
    /** Read-only mount */
    readOnly?: boolean;
}

export interface ContainerState {
    /** Docker container ID */
    containerId: string;
    /** Container name */
    name: string;
    /** Whether the container is running */
    running: boolean;
    /** Image used */
    image: string;
    /** When the container was created */
    createdAt: Date;
}

export interface SandboxExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
    enabled: false,
    image: 'node:20-slim',
    timeout: 60000,
    mounts: [
        { hostPath: '.', containerPath: '/project', readOnly: false },
    ],
    network: 'bridge',
    autoDestroy: true,
};
