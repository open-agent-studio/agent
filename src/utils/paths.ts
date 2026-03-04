import path from 'node:path';
import os from 'node:os';

/**
 * Resolve a path relative to the current working directory
 */
export function resolveProjectPath(...segments: string[]): string {
    return path.resolve(process.cwd(), ...segments);
}

/**
 * Get the .agent directory path for the current project
 */
export function getAgentDir(cwd: string = process.cwd()): string {
    return path.resolve(cwd, '.agent');
}

/**
 * Get the skills directory
 */
export function getSkillsDir(cwd?: string): string {
    return path.join(getAgentDir(cwd), 'skills');
}

/**
 * Get the plans directory
 */
export function getPlansDir(cwd?: string): string {
    return path.join(getAgentDir(cwd), 'plans');
}

/**
 * Get the runs directory
 */
export function getRunsDir(cwd?: string): string {
    return path.join(getAgentDir(cwd), 'runs');
}

/**
 * Get the plugins directory
 */
export function getPluginsDir(cwd?: string): string {
    return path.join(getAgentDir(cwd), 'plugins');
}

/**
 * Get the logs directory
 */
export function getLogsDir(): string {
    return path.join(getAgentDir(), 'logs');
}

/**
 * Get the global agent config directory
 */
export function getGlobalAgentDir(): string {
    return path.join(os.homedir(), '.agent-runtime');
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
    return resolveProjectPath('agent.config.json');
}

/**
 * Generate a unique run ID with timestamp
 */
export function generateRunId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).substring(2, 8);
    return `run-${timestamp}-${rand}`;
}

/**
 * Normalize a tool or skill name
 */
export function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}
