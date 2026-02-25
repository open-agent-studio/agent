import { z } from 'zod';

/**
 * Script System — Types
 *
 * Scripts are repeatable, scriptable tasks — direct execution of shell/Node
 * scripts without LLM involvement. They fill the gap between heavy Skills
 * (LLM-driven) and lightweight Commands (markdown prompts).
 *
 * Scripts live in `.agent/scripts/` or inside plugins, defined via `script.yaml`.
 */

// ─── Script Argument Definition ───

export interface ScriptArgDef {
    /** Human-readable description of the argument */
    description: string;
    /** Argument type: string, boolean, or number */
    type?: 'string' | 'boolean' | 'number';
    /** Default value if not provided */
    default?: string | boolean | number;
    /** Whether this argument is required */
    required?: boolean;
}

// ─── Script Manifest (script.yaml) ───

export interface ScriptManifest {
    /** Unique script name */
    name: string;
    /** Semver version */
    version?: string;
    /** Human-readable description */
    description: string;
    /** Author name */
    author?: string;
    /** The script file to execute (relative to script directory) */
    entrypoint: string;
    /** Interpreter override (auto-detected from extension if omitted) */
    interpreter?: string;
    /** Environment variables to inject */
    env?: Record<string, string>;
    /** Named arguments with definitions */
    args?: Record<string, ScriptArgDef>;
    /** Working directory relative to project root (default: '.') */
    cwd?: string;
    /** Timeout in ms (default: 300000 = 5 min) */
    timeout?: number;
    /** Whether to prompt for confirmation before execution */
    confirm?: boolean;
    /** Tags for discoverability */
    tags?: string[];
}

// ─── Zod Schema for Validation ───

const ScriptArgDefSchema = z.object({
    description: z.string(),
    type: z.enum(['string', 'boolean', 'number']).default('string'),
    default: z.union([z.string(), z.boolean(), z.number()]).optional(),
    required: z.boolean().default(false),
});

export const ScriptManifestSchema = z.object({
    name: z.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/, 'Must be lowercase alphanumeric with dots, underscores, hyphens'),
    version: z.string().optional(),
    description: z.string().min(1),
    author: z.string().optional(),
    entrypoint: z.string().min(1),
    interpreter: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    args: z.record(z.string(), ScriptArgDefSchema).optional(),
    cwd: z.string().default('.'),
    timeout: z.number().default(300_000),
    confirm: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
});

// ─── Loaded Script ───

export interface LoadedScript {
    /** Parsed manifest */
    manifest: ScriptManifest;
    /** Absolute path to the script directory */
    path: string;
    /** Absolute path to the entrypoint file */
    entrypointPath: string;
    /** Source: 'project' or plugin name */
    source: string;
}

// ─── Script Run Result ───

export interface ScriptRunResult {
    /** Whether the script exited with code 0 */
    success: boolean;
    /** Process exit code */
    exitCode: number;
    /** Standard output */
    stdout: string;
    /** Standard error */
    stderr: string;
    /** Duration in milliseconds */
    durationMs: number;
}
