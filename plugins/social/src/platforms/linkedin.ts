/**
 * LinkedIn Platform Adapter
 *
 * Uses the LinkedIn Marketing API (v2) + Share API to:
 * - Authenticate via OAuth 2.0
 * - Post text, images, and articles to a user's LinkedIn profile
 *
 * Required Scopes: openid, profile, w_member_social
 * API Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
 */

import {
    SocialPlatform, credentialKey,
    type PostContent, type PostResult, type AuthStatus, type OAuthConfig,
    type CredentialGetter, type CredentialSetter,
} from './base.js';
import { buildAuthUrl, exchangeCodeForToken, refreshAccessToken } from '../oauth/flow.js';
import { waitForOAuthCallback, getRedirectUri } from '../oauth/server.js';
import { getStoredTokens, saveTokens, isTokenExpired } from '../oauth/tokens.js';

const OAUTH_PORT = 9876;
const PLATFORM = 'LINKEDIN';

export class LinkedInPlatform extends SocialPlatform {
    readonly name = 'linkedin';
    readonly displayName = 'LinkedIn';
    readonly capabilities = ['text', 'image', 'link', 'article'];

    private getOAuthConfig(clientId: string, clientSecret: string): OAuthConfig {
        return {
            clientId,
            clientSecret,
            redirectUri: getRedirectUri(OAUTH_PORT),
            authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
            tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
            scopes: ['openid', 'profile', 'w_member_social'],
        };
    }

    async isAuthenticated(getCred: CredentialGetter): Promise<boolean> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        if (!tokens.accessToken) return false;
        if (isTokenExpired(tokens.expiresAt)) return false;
        return true;
    }

    async authenticate(
        getCred: CredentialGetter,
        setCred: CredentialSetter,
        openBrowser: (url: string) => void,
    ): Promise<AuthStatus> {
        const clientId = await getCred(credentialKey(PLATFORM, 'CLIENT_ID'));
        const clientSecret = await getCred(credentialKey(PLATFORM, 'CLIENT_SECRET'));

        if (!clientId || !clientSecret) {
            return {
                platform: this.name,
                authenticated: false,
                error: 'Missing SOCIAL_LINKEDIN_CLIENT_ID or SOCIAL_LINKEDIN_CLIENT_SECRET. Please set them in your credentials.',
            } as any;
        }

        const config = this.getOAuthConfig(clientId, clientSecret);
        const authUrl = buildAuthUrl({ config, state: 'linkedin-oas' });

        // Start callback server and open browser
        const callbackPromise = waitForOAuthCallback(OAUTH_PORT);
        openBrowser(authUrl);

        const { code } = await callbackPromise;

        // Exchange code for tokens
        const tokenRes = await exchangeCodeForToken(config, code);
        await saveTokens(PLATFORM, setCred, tokenRes.access_token, tokenRes.refresh_token, tokenRes.expires_in);

        // Fetch user profile
        const profile = await this.fetchProfile(tokenRes.access_token);

        return {
            platform: this.name,
            authenticated: true,
            username: profile.name,
            scopes: config.scopes,
        };
    }

    async post(content: PostContent, getCred: CredentialGetter): Promise<PostResult> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        if (!tokens.accessToken) {
            return { success: false, platform: this.name, error: 'Not authenticated. Run social.auth first.', timestamp: new Date().toISOString() };
        }

        try {
            // Get the user's LinkedIn URN
            const profile = await this.fetchProfile(tokens.accessToken);
            const authorUrn = profile.sub; // OpenID 'sub' = person URN

            // Build the Share API payload
            const postBody: any = {
                author: `urn:li:person:${authorUrn}`,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: this.formatText(content.text, 3000, content.tags),
                        },
                        shareMediaCategory: 'NONE',
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };

            // If there's a link, attach it as an article
            if (content.linkUrl) {
                postBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
                postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [{
                    status: 'READY',
                    originalUrl: content.linkUrl,
                }];
            }

            const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify(postBody),
            });

            if (!res.ok) {
                const errText = await res.text();
                return { success: false, platform: this.name, error: `LinkedIn API error (${res.status}): ${errText}`, timestamp: new Date().toISOString() };
            }

            const result = await res.json() as any;
            return {
                success: true,
                platform: this.name,
                postId: result.id,
                postUrl: `https://www.linkedin.com/feed/update/${result.id}`,
                timestamp: new Date().toISOString(),
            };
        } catch (err) {
            return { success: false, platform: this.name, error: (err as Error).message, timestamp: new Date().toISOString() };
        }
    }

    async getAuthStatus(getCred: CredentialGetter): Promise<AuthStatus> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        if (!tokens.accessToken || isTokenExpired(tokens.expiresAt)) {
            return { platform: this.name, authenticated: false };
        }
        try {
            const profile = await this.fetchProfile(tokens.accessToken);
            return { platform: this.name, authenticated: true, username: profile.name, expiresAt: tokens.expiresAt || undefined };
        } catch {
            return { platform: this.name, authenticated: false };
        }
    }

    async refreshToken(getCred: CredentialGetter, setCred: CredentialSetter): Promise<boolean> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        if (!tokens.refreshToken) return false;
        const clientId = await getCred(credentialKey(PLATFORM, 'CLIENT_ID'));
        const clientSecret = await getCred(credentialKey(PLATFORM, 'CLIENT_SECRET'));
        if (!clientId || !clientSecret) return false;

        try {
            const config = this.getOAuthConfig(clientId, clientSecret);
            const res = await refreshAccessToken(config, tokens.refreshToken);
            await saveTokens(PLATFORM, setCred, res.access_token, res.refresh_token, res.expires_in);
            return true;
        } catch {
            return false;
        }
    }

    private async fetchProfile(accessToken: string): Promise<any> {
        const res = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${res.status}`);
        return res.json();
    }
}
