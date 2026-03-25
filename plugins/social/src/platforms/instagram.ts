/**
 * Instagram Platform Adapter
 *
 * Uses the Instagram Graph API (via Meta) to:
 * - Authenticate via Facebook OAuth (Instagram Business accounts)
 * - Post images and carousels to Instagram
 *
 * Note: Instagram posting requires an Instagram Business/Creator account
 * linked to a Facebook Page. Text-only posts are NOT supported by the API.
 *
 * Required Scopes: instagram_basic, instagram_content_publish
 * API Docs: https://developers.facebook.com/docs/instagram-api/
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
const PLATFORM = 'INSTAGRAM';
const GRAPH_API = 'https://graph.facebook.com/v19.0';

export class InstagramPlatform extends SocialPlatform {
    readonly name = 'instagram';
    readonly displayName = 'Instagram';
    readonly capabilities = ['image', 'carousel', 'story'];

    private getOAuthConfig(clientId: string, clientSecret: string): OAuthConfig {
        return {
            clientId,
            clientSecret,
            redirectUri: getRedirectUri(OAUTH_PORT),
            authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
            tokenUrl: `${GRAPH_API}/oauth/access_token`,
            scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
        };
    }

    async isAuthenticated(getCred: CredentialGetter): Promise<boolean> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        const igAccountId = await getCred(credentialKey(PLATFORM, 'ACCOUNT_ID'));
        return !!tokens.accessToken && !!igAccountId && !isTokenExpired(tokens.expiresAt);
    }

    async authenticate(
        getCred: CredentialGetter,
        setCred: CredentialSetter,
        openBrowser: (url: string) => void,
    ): Promise<AuthStatus> {
        // Instagram uses the same Meta/Facebook OAuth flow
        const clientId = await getCred(credentialKey('META', 'CLIENT_ID'));
        const clientSecret = await getCred(credentialKey('META', 'CLIENT_SECRET'));

        if (!clientId || !clientSecret) {
            return { platform: this.name, authenticated: false } as any;
        }

        const config = this.getOAuthConfig(clientId, clientSecret);
        const authUrl = buildAuthUrl({ config, state: 'instagram-oas' });

        const callbackPromise = waitForOAuthCallback(OAUTH_PORT);
        openBrowser(authUrl);

        const { code } = await callbackPromise;
        const tokenRes = await exchangeCodeForToken(config, code);

        // Get long-lived token
        const longUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenRes.access_token}`;
        const longRes = await fetch(longUrl);
        const longData = await longRes.json() as any;

        await saveTokens(PLATFORM, setCred, longData.access_token, undefined, longData.expires_in);

        // Discover the Instagram Business Account ID
        const igAccountId = await this.discoverInstagramAccount(longData.access_token);
        if (igAccountId) {
            await setCred(credentialKey(PLATFORM, 'ACCOUNT_ID'), igAccountId);
        }

        return {
            platform: this.name,
            authenticated: true,
            username: igAccountId ? `IG:${igAccountId}` : 'Unknown',
            scopes: config.scopes,
        };
    }

    async post(content: PostContent, getCred: CredentialGetter): Promise<PostResult> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        const igAccountId = await getCred(credentialKey(PLATFORM, 'ACCOUNT_ID'));

        if (!tokens.accessToken || !igAccountId) {
            return { success: false, platform: this.name, error: 'Not authenticated.', timestamp: new Date().toISOString() };
        }

        if (!content.imageUrl) {
            return { success: false, platform: this.name, error: 'Instagram requires an image. Text-only posts are not supported by the API.', timestamp: new Date().toISOString() };
        }

        try {
            const caption = this.formatText(content.text, 2200, content.tags);

            // Step 1: Create a media container
            const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: content.imageUrl,
                    caption,
                    access_token: tokens.accessToken,
                }),
            });

            if (!containerRes.ok) {
                const errText = await containerRes.text();
                return { success: false, platform: this.name, error: `IG container error (${containerRes.status}): ${errText}`, timestamp: new Date().toISOString() };
            }

            const container = await containerRes.json() as any;

            // Step 2: Publish the container
            const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: container.id,
                    access_token: tokens.accessToken,
                }),
            });

            if (!publishRes.ok) {
                const errText = await publishRes.text();
                return { success: false, platform: this.name, error: `IG publish error (${publishRes.status}): ${errText}`, timestamp: new Date().toISOString() };
            }

            const result = await publishRes.json() as any;
            return {
                success: true,
                platform: this.name,
                postId: result.id,
                postUrl: `https://www.instagram.com/`,
                timestamp: new Date().toISOString(),
            };
        } catch (err) {
            return { success: false, platform: this.name, error: (err as Error).message, timestamp: new Date().toISOString() };
        }
    }

    async getAuthStatus(getCred: CredentialGetter): Promise<AuthStatus> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        const igAccountId = await getCred(credentialKey(PLATFORM, 'ACCOUNT_ID'));
        if (!tokens.accessToken || !igAccountId || isTokenExpired(tokens.expiresAt)) {
            return { platform: this.name, authenticated: false };
        }
        return { platform: this.name, authenticated: true, username: `IG:${igAccountId}`, expiresAt: tokens.expiresAt || undefined };
    }

    /**
     * Discover the user's Instagram Business Account ID from their Facebook Pages
     */
    private async discoverInstagramAccount(userToken: string): Promise<string | null> {
        try {
            const pagesRes = await fetch(`${GRAPH_API}/me/accounts?fields=instagram_business_account&access_token=${userToken}`);
            const pages = await pagesRes.json() as any;

            for (const page of (pages.data || [])) {
                if (page.instagram_business_account?.id) {
                    return page.instagram_business_account.id;
                }
            }
        } catch {
            // Discovery failed
        }
        return null;
    }
}
