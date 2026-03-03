import type { ToolResult, ExecutionContext } from '../tools/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { CredentialStore } from './store.js';
import { z } from 'zod';

/**
 * Register credential tools (secrets.get, secrets.list, secrets.set)
 */
export function registerCredentialTools(registry: ToolRegistry, store: CredentialStore): void {
    if (!registry.has('secrets.get')) {
        registry.register({
            name: 'secrets.get',
            category: 'secrets',
            description: 'Get a credential/secret value by key. Checks vault, .env, and environment variables. If not found, may prompt the user interactively.',
            inputSchema: z.object({
                key: z.string().describe('The credential key (e.g., GITHUB_TOKEN, APIFY_TOKEN)'),
                reason: z.string().optional().describe('Why this credential is needed — shown to user if interactive capture is triggered'),
            }),
            outputSchema: z.object({
                value: z.string().nullable(),
                source: z.string(),
            }),
            permissions: ['secrets'] as any,
            execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
                const start = Date.now();
                try {
                    const value = await store.get(input.key, input.reason);
                    return {
                        success: !!value,
                        data: {
                            value: value || null,
                            source: value ? 'vault' : 'not_found',
                        },
                        durationMs: Date.now() - start,
                    };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
                }
            },
        } as any);
    }

    if (!registry.has('secrets.list')) {
        registry.register({
            name: 'secrets.list',
            category: 'secrets',
            description: 'List all known credential keys. Does NOT return values — only key names.',
            inputSchema: z.object({}),
            outputSchema: z.object({
                keys: z.array(z.string()),
            }),
            permissions: ['secrets'] as any,
            execute: async (_input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
                const start = Date.now();
                try {
                    const keys = await store.list();
                    return {
                        success: true,
                        data: { keys },
                        durationMs: Date.now() - start,
                    };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
                }
            },
        } as any);
    }

    if (!registry.has('secrets.set')) {
        registry.register({
            name: 'secrets.set',
            category: 'secrets',
            description: 'Store a credential in the encrypted vault. Use this to save API keys or tokens for future use.',
            inputSchema: z.object({
                key: z.string().describe('The credential key (e.g., GITHUB_TOKEN)'),
                value: z.string().describe('The credential value'),
            }),
            outputSchema: z.object({
                stored: z.boolean(),
            }),
            permissions: ['secrets'] as any,
            execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
                const start = Date.now();
                try {
                    await store.set(input.key, input.value);
                    return {
                        success: true,
                        data: { stored: true },
                        durationMs: Date.now() - start,
                    };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
                }
            },
        } as any);
    }
}
