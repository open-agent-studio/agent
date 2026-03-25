/**
 * Social Media Plugin — Main Entry Point
 *
 * Registers the unified `social.*` tools into the Agent's ToolRegistry:
 *   - social.post      — Post to one or more platforms
 *   - social.auth      — Authenticate with a platform
 *   - social.status    — Check auth status for all platforms
 *   - social.platforms — List available platforms and capabilities
 */

import { z } from 'zod';
import type { SocialPlatform, PostContent, PostResult, AuthStatus, CredentialGetter, CredentialSetter } from './platforms/base.js';
import { LinkedInPlatform } from './platforms/linkedin.js';
import { TwitterPlatform } from './platforms/twitter.js';
import { FacebookPlatform } from './platforms/facebook.js';
import { InstagramPlatform } from './platforms/instagram.js';

// ─── Platform Registry ───

const platforms: Map<string, SocialPlatform> = new Map();

function registerPlatform(p: SocialPlatform) {
    platforms.set(p.name, p);
}

registerPlatform(new LinkedInPlatform());
registerPlatform(new TwitterPlatform());
registerPlatform(new FacebookPlatform());
registerPlatform(new InstagramPlatform());

// ─── Tool Registration ───

/**
 * Register social media tools into the Agent's ToolRegistry.
 *
 * @param registry - The Agent's ToolRegistry instance
 * @param getCred - Function to read credentials from the vault
 * @param setCred - Function to write credentials to the vault
 */
export function registerSocialTools(
    registry: any,
    getCred: CredentialGetter,
    setCred: CredentialSetter,
): void {

    // ── social.platforms ──
    if (!registry.has('social.platforms')) {
        registry.register({
            name: 'social.platforms',
            category: 'social',
            description: 'List all available social media platforms and their capabilities (text, image, thread, etc.)',
            inputSchema: z.object({}),
            outputSchema: z.any(),
            permissions: [],
            execute: async () => {
                const result = [];
                for (const [, p] of platforms) {
                    const status = await p.getAuthStatus(getCred);
                    result.push({
                        name: p.name,
                        displayName: p.displayName,
                        capabilities: p.capabilities,
                        authenticated: status.authenticated,
                        username: status.username,
                    });
                }
                return { success: true, data: result, durationMs: 0 };
            },
        });
    }

    // ── social.status ──
    if (!registry.has('social.status')) {
        registry.register({
            name: 'social.status',
            category: 'social',
            description: 'Check authentication status for all connected social media platforms.',
            inputSchema: z.object({
                platform: z.string().optional().describe('Specific platform to check (linkedin, twitter, facebook, instagram). Omit for all.'),
            }),
            outputSchema: z.any(),
            permissions: [],
            execute: async (input: any) => {
                const results: AuthStatus[] = [];
                if (input.platform) {
                    const p = platforms.get(input.platform);
                    if (!p) return { success: false, error: `Unknown platform: ${input.platform}`, durationMs: 0 };
                    results.push(await p.getAuthStatus(getCred));
                } else {
                    for (const [, p] of platforms) {
                        results.push(await p.getAuthStatus(getCred));
                    }
                }
                return { success: true, data: results, durationMs: 0 };
            },
        });
    }

    // ── social.auth ──
    if (!registry.has('social.auth')) {
        registry.register({
            name: 'social.auth',
            category: 'social',
            description: 'Start the OAuth authentication flow for a social media platform. Opens a browser for the user to authorize.',
            inputSchema: z.object({
                platform: z.string().describe('Platform to authenticate: linkedin, twitter, facebook, or instagram'),
            }),
            outputSchema: z.any(),
            permissions: ['network'],
            execute: async (input: any) => {
                const p = platforms.get(input.platform);
                if (!p) return { success: false, error: `Unknown platform: ${input.platform}`, durationMs: 0 };

                const openBrowser = (url: string) => {
                    const { exec } = require('node:child_process');
                    const cmd = process.platform === 'darwin' ? `open "${url}"`
                        : process.platform === 'win32' ? `start "${url}"`
                        : `xdg-open "${url}"`;
                    exec(cmd);
                };

                try {
                    const status = await p.authenticate(getCred, setCred, openBrowser);
                    return { success: true, data: status, durationMs: 0 };
                } catch (err) {
                    return { success: false, error: (err as Error).message, durationMs: 0 };
                }
            },
        });
    }

    // ── social.post ──
    if (!registry.has('social.post')) {
        registry.register({
            name: 'social.post',
            category: 'social',
            description: 'Post content to one or more social media platforms. Specify which platforms to target.',
            inputSchema: z.object({
                platforms: z.array(z.string()).describe('Array of platform names to post to: linkedin, twitter, facebook, instagram'),
                text: z.string().describe('The text content of the post'),
                imageUrl: z.string().optional().describe('Optional image URL to attach'),
                linkUrl: z.string().optional().describe('Optional link URL to include'),
                tags: z.array(z.string()).optional().describe('Optional hashtags (without #)'),
            }),
            outputSchema: z.any(),
            permissions: ['network'],
            execute: async (input: any) => {
                const content: PostContent = {
                    text: input.text,
                    imageUrl: input.imageUrl,
                    linkUrl: input.linkUrl,
                    tags: input.tags,
                };

                const results: PostResult[] = [];
                for (const name of input.platforms) {
                    const p = platforms.get(name);
                    if (!p) {
                        results.push({ success: false, platform: name, error: `Unknown platform: ${name}`, timestamp: new Date().toISOString() });
                        continue;
                    }

                    // Check auth and try refresh if expired
                    const authenticated = await p.isAuthenticated(getCred);
                    if (!authenticated && p.refreshToken) {
                        await p.refreshToken(getCred, setCred);
                    }

                    const result = await p.post(content, getCred);
                    results.push(result);
                }

                const allSuccess = results.every(r => r.success);
                return {
                    success: allSuccess,
                    data: {
                        posted: results.filter(r => r.success).length,
                        failed: results.filter(r => !r.success).length,
                        results,
                    },
                    durationMs: 0,
                };
            },
        });
    }
}
