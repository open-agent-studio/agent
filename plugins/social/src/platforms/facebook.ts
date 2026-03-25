/**
 * Meta / Facebook Platform Adapter
 *
 * Uses the Graph API v19.0 to:
 * - Authenticate via OAuth 2.0 (Facebook Login)
 * - Post to Facebook Pages managed by the user
 *
 * Required Scopes: pages_manage_posts, pages_read_engagement
 * API Docs: https://developers.facebook.com/docs/graph-api/
 */

import {
    SocialPlatform, credentialKey,
    type PostContent, type PostResult, type AuthStatus, type OAuthConfig,
    type CredentialGetter, type CredentialSetter,
} from './base.js';
import { buildAuthUrl, exchangeCodeForToken } from '../oauth/flow.js';
import { waitForOAuthCallback, getRedirectUri } from '../oauth/server.js';
import { getStoredTokens, saveTokens, isTokenExpired } from '../oauth/tokens.js';

const OAUTH_PORT = 9876;
const PLATFORM = 'META';
const GRAPH_API = 'https://graph.facebook.com/v19.0';

export class FacebookPlatform extends SocialPlatform {
    readonly name = 'facebook';
    readonly displayName = 'Facebook';
    readonly capabilities = ['text', 'image', 'link', 'page_post'];

    private getOAuthConfig(clientId: string, clientSecret: string): OAuthConfig {
        return {
            clientId,
            clientSecret,
            redirectUri: getRedirectUri(OAUTH_PORT),
            authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
            tokenUrl: `${GRAPH_API}/oauth/access_token`,
            scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
        };
    }

    async isAuthenticated(getCred: CredentialGetter): Promise<boolean> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        return !!tokens.accessToken && !isTokenExpired(tokens.expiresAt);
    }

    async authenticate(
        getCred: CredentialGetter,
        setCred: CredentialSetter,
        openBrowser: (url: string) => void,
    ): Promise<AuthStatus> {
        const clientId = await getCred(credentialKey(PLATFORM, 'CLIENT_ID'));
        const clientSecret = await getCred(credentialKey(PLATFORM, 'CLIENT_SECRET'));

        if (!clientId || !clientSecret) {
            return { platform: this.name, authenticated: false } as any;
        }

        const config = this.getOAuthConfig(clientId, clientSecret);
        const authUrl = buildAuthUrl({ config, state: 'meta-oas' });

        const callbackPromise = waitForOAuthCallback(OAUTH_PORT);
        openBrowser(authUrl);

        const { code } = await callbackPromise;

        // Exchange for short-lived user token
        const tokenRes = await exchangeCodeForToken(config, code);

        // Exchange short-lived token for long-lived token (60 days)
        const longLived = await this.exchangeForLongLivedToken(clientId, clientSecret, tokenRes.access_token);
        await saveTokens(PLATFORM, setCred, longLived.access_token, undefined, longLived.expires_in);

        // Get the user's managed pages and store the first page token
        const pages = await this.fetchPages(longLived.access_token);
        if (pages.length > 0) {
            await setCred(credentialKey(PLATFORM, 'PAGE_ID'), pages[0].id);
            await setCred(credentialKey(PLATFORM, 'PAGE_TOKEN'), pages[0].access_token);
            await setCred(credentialKey(PLATFORM, 'PAGE_NAME'), pages[0].name);
        }

        return {
            platform: this.name,
            authenticated: true,
            username: pages.length > 0 ? pages[0].name : 'User',
            scopes: config.scopes,
        };
    }

    async post(content: PostContent, getCred: CredentialGetter): Promise<PostResult> {
        const pageToken = await getCred(credentialKey(PLATFORM, 'PAGE_TOKEN'));
        const pageId = await getCred(credentialKey(PLATFORM, 'PAGE_ID'));

        if (!pageToken || !pageId) {
            return { success: false, platform: this.name, error: 'Not authenticated or no page selected.', timestamp: new Date().toISOString() };
        }

        try {
            const text = this.formatText(content.text, 63206, content.tags);

            const body: Record<string, any> = { message: text, access_token: pageToken };
            if (content.linkUrl) body.link = content.linkUrl;

            const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                return { success: false, platform: this.name, error: `Facebook API error (${res.status}): ${errText}`, timestamp: new Date().toISOString() };
            }

            const result = await res.json() as any;
            return {
                success: true,
                platform: this.name,
                postId: result.id,
                postUrl: `https://www.facebook.com/${result.id}`,
                timestamp: new Date().toISOString(),
            };
        } catch (err) {
            return { success: false, platform: this.name, error: (err as Error).message, timestamp: new Date().toISOString() };
        }
    }

    async getAuthStatus(getCred: CredentialGetter): Promise<AuthStatus> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        const pageName = await getCred(credentialKey(PLATFORM, 'PAGE_NAME'));
        if (!tokens.accessToken || isTokenExpired(tokens.expiresAt)) {
            return { platform: this.name, authenticated: false };
        }
        return { platform: this.name, authenticated: true, username: pageName || 'Page', expiresAt: tokens.expiresAt || undefined };
    }

    private async exchangeForLongLivedToken(clientId: string, clientSecret: string, shortToken: string) {
        const url = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortToken}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Long-lived token exchange failed: ${res.status}`);
        return res.json() as Promise<{ access_token: string; expires_in: number }>;
    }

    private async fetchPages(userToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
        const res = await fetch(`${GRAPH_API}/me/accounts?access_token=${userToken}`);
        if (!res.ok) return [];
        const data = await res.json() as any;
        return data.data || [];
    }
}
