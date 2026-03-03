import type { ToolRegistry } from '../tools/registry.js';
import type { ToolResult, ExecutionContext } from '../tools/types.js';
import type { ScriptLoader } from '../scripts/loader.js';
import type { CommandLoader } from '../commands/loader.js';
import { z } from 'zod';

/**
 * Register script.run tool — lets the LLM execute project scripts
 */
export function registerScriptTool(registry: ToolRegistry, scriptLoader: ScriptLoader, projectRoot: string): void {
    if (registry.has('script.run')) return;

    registry.register({
        name: 'script.run',
        category: 'exec',
        description: 'Run a project script by name. Use secrets.list to see available scripts. Scripts are located in .agent/scripts/.',
        inputSchema: z.object({
            name: z.string().describe('Script name to run'),
            args: z.record(z.string()).optional().describe('Arguments to pass to the script'),
        }),
        outputSchema: z.object({
            stdout: z.string(),
            stderr: z.string(),
            exitCode: z.number(),
        }),
        permissions: ['exec'] as any,
        execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
            const start = Date.now();
            try {
                const script = scriptLoader.get(input.name);
                if (!script) {
                    return {
                        success: false,
                        error: `Script "${input.name}" not found. Available: ${scriptLoader.list().map(s => s.manifest.name).join(', ') || 'none'}`,
                        durationMs: Date.now() - start,
                    };
                }

                const { ScriptRunner } = await import('../scripts/runner.js');
                const runner = new ScriptRunner();
                const result = await runner.run(script, input.args || {}, { projectRoot });

                return {
                    success: result.exitCode === 0,
                    data: {
                        stdout: result.stdout?.slice(0, 3000) || '',
                        stderr: result.stderr?.slice(0, 1000) || '',
                        exitCode: result.exitCode,
                    },
                    durationMs: Date.now() - start,
                };
            } catch (err) {
                return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
            }
        },
    } as any);
}

/**
 * Register command.execute tool — lets the LLM run project commands
 * Commands are markdown files with instructions that get executed via the LLM skill runner.
 */
export function registerCommandTool(registry: ToolRegistry, commandLoader: CommandLoader): void {
    if (registry.has('command.execute')) return;

    registry.register({
        name: 'command.execute',
        category: 'exec',
        description: 'Execute a project command by name. Commands are pre-defined automation workflows. Returns the command\'s prompt text to be followed.',
        inputSchema: z.object({
            name: z.string().describe('Command name to execute'),
        }),
        outputSchema: z.object({
            prompt: z.string(),
            description: z.string(),
        }),
        permissions: ['exec'] as any,
        execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
            const start = Date.now();
            try {
                const cmd = commandLoader.get(input.name);
                if (!cmd) {
                    return {
                        success: false,
                        error: `Command "${input.name}" not found. Available: ${commandLoader.list().map(c => c.name).join(', ') || 'none'}`,
                        durationMs: Date.now() - start,
                    };
                }

                return {
                    success: true,
                    data: {
                        prompt: cmd.prompt,
                        description: cmd.description,
                    },
                    durationMs: Date.now() - start,
                };
            } catch (err) {
                return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
            }
        },
    } as any);
}
