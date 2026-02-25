import { spawn } from 'node:child_process';
import path from 'node:path';
import type { LoadedScript, ScriptRunResult, ScriptArgDef } from './types.js';

/**
 * Script Runner — executes scripts as child processes
 *
 * Features:
 * - Auto-detects interpreter from file extension
 * - Injects env vars and script args as SCRIPT_ARG_* env vars
 * - Applies timeout from manifest
 * - Streams stdout/stderr in real-time
 * - Returns structured result with exit code
 */
export class ScriptRunner {
    /**
     * Execute a loaded script with optional arguments
     */
    async run(
        script: LoadedScript,
        args: Record<string, string | boolean | number> = {},
        options: { projectRoot?: string; onStdout?: (data: string) => void; onStderr?: (data: string) => void } = {}
    ): Promise<ScriptRunResult> {
        const start = Date.now();
        const manifest = script.manifest;

        // Validate required args
        if (manifest.args) {
            for (const [argName, argDef] of Object.entries(manifest.args)) {
                if (argDef.required && !(argName in args) && argDef.default === undefined) {
                    return {
                        success: false,
                        exitCode: 1,
                        stdout: '',
                        stderr: `Missing required argument: ${argName} — ${argDef.description}`,
                        durationMs: Date.now() - start,
                    };
                }
            }
        }

        // Resolve working directory
        const projectRoot = options.projectRoot ?? process.cwd();
        const cwd = path.resolve(projectRoot, manifest.cwd ?? '.');

        // Determine interpreter
        const { command, commandArgs } = this.resolveInterpreter(script);

        // Build environment variables
        const env: Record<string, string> = {
            ...process.env as Record<string, string>,
            SCRIPT_NAME: manifest.name,
            SCRIPT_DIR: script.path,
            ...(manifest.env ?? {}),
        };

        // Inject args as SCRIPT_ARG_* env vars and as positional hints
        const resolvedArgs = this.resolveArgs(manifest.args ?? {}, args);
        for (const [key, value] of Object.entries(resolvedArgs)) {
            env[`SCRIPT_ARG_${key.toUpperCase().replace(/-/g, '_')}`] = String(value);
        }

        return new Promise<ScriptRunResult>((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const proc = spawn(command, commandArgs, {
                cwd,
                env,
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: command === 'bash' || command === 'sh' || command === 'zsh',
            });

            // Timeout handling
            const timeout = manifest.timeout ?? 300_000;
            const timer = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
                setTimeout(() => proc.kill('SIGKILL'), 5000);
            }, timeout);

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                stdout += text;
                if (options.onStdout) {
                    options.onStdout(text);
                } else {
                    process.stdout.write(text);
                }
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                stderr += text;
                if (options.onStderr) {
                    options.onStderr(text);
                } else {
                    process.stderr.write(text);
                }
            });

            proc.on('close', (code) => {
                clearTimeout(timer);

                if (timedOut) {
                    stderr += `\nScript timed out after ${timeout}ms`;
                }

                resolve({
                    success: code === 0 && !timedOut,
                    exitCode: code ?? 1,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    durationMs: Date.now() - start,
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    success: false,
                    exitCode: 1,
                    stdout: '',
                    stderr: err.message,
                    durationMs: Date.now() - start,
                });
            });
        });
    }

    /**
     * Determine the interpreter and args from the script's entrypoint extension
     */
    private resolveInterpreter(script: LoadedScript): { command: string; commandArgs: string[] } {
        const { manifest, entrypointPath } = script;

        if (manifest.interpreter) {
            return {
                command: manifest.interpreter,
                commandArgs: [entrypointPath],
            };
        }

        const ext = path.extname(entrypointPath).toLowerCase();

        switch (ext) {
            case '.sh':
            case '.bash':
                return { command: 'bash', commandArgs: [entrypointPath] };
            case '.zsh':
                return { command: 'zsh', commandArgs: [entrypointPath] };
            case '.ts':
                return { command: 'npx', commandArgs: ['tsx', entrypointPath] };
            case '.mts':
                return { command: 'npx', commandArgs: ['tsx', entrypointPath] };
            case '.js':
            case '.mjs':
                return { command: 'node', commandArgs: [entrypointPath] };
            case '.py':
                return { command: 'python3', commandArgs: [entrypointPath] };
            case '.rb':
                return { command: 'ruby', commandArgs: [entrypointPath] };
            default:
                // Try to execute directly (must be executable)
                return { command: entrypointPath, commandArgs: [] };
        }
    }

    /**
     * Resolve args by merging provided values with defaults
     */
    private resolveArgs(
        argDefs: Record<string, ScriptArgDef>,
        provided: Record<string, string | boolean | number>
    ): Record<string, string | boolean | number> {
        const resolved: Record<string, string | boolean | number> = {};

        for (const [name, def] of Object.entries(argDefs)) {
            if (name in provided) {
                resolved[name] = provided[name];
            } else if (def.default !== undefined) {
                resolved[name] = def.default;
            }
        }

        // Also pass through any extra args not in the manifest
        for (const [name, value] of Object.entries(provided)) {
            if (!(name in resolved)) {
                resolved[name] = value;
            }
        }

        return resolved;
    }
}
