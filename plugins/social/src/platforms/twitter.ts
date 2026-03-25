/**
 * X / Twitter Platform Adapter
 *
 * Uses the X API v2 with OAuth 2.0 (PKCE) to:
 * - Authenticate users via browser-based OAuth
 * - Post tweets, threads, and images
 *
 * Required Scopes: tweet.read, tweet.write, users.read
 * API Docs: https://developer.x.com/en/docs/x-api
 */

import {
    SocialPlatform, credentialKey,
    type PostContent, type PostResult, type AuthStatus, type OAuthConfig,
    type CredentialGetter, type CredentialSetter,
} from './base.js';
import { buildAuthUrl, exchangeCodeForToken, refreshAccessToken, generateCodeVerifier, generateCodeChallenge } from '../oauth/flow.js';
import { waitForOAuthCallback, getRedirectUri } from '../oauth/server.js';
import { getStoredTokens, saveTokens, isTokenExpired } from '../oauth/tokens.js';

const OAUTH_PORT = 9876;
const PLATFORM = 'TWITTER';

export class TwitterPlatform extends SocialPlatform {
    readonly name = 'twitter';
    readonly displayName = 'X (Twitter)';
    readonly capabilities = ['text', 'image', 'thread', 'poll'];

    private getOAuthConfig(clientId: string, clientSecret: string): OAuthConfig {
        return {
            clientId,
            clientSecret,
            redirectUri: getRedirectUri(OAUTH_PORT),
            authUrl: 'https://twitter.com/i/oauth2/authorize',
            tokenUrl: 'https://api.twitter.com/2/oauth2/token',
            scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
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
                error: 'Missing SOCIAL_TWITTER_CLIENT_ID or SOCIAL_TWITTER_CLIENT_SECRET.',
            } as any;
        }

        const config = this.getOAuthConfig(clientId, clientSecret);

        // X requires PKCE
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        const authUrl = buildAuthUrl({
            config,
            state: 'twitter-oas',
            codeChallenge,
            codeChallengeMethod: 'S256',
        });

        const callbackPromise = waitForOAuthCallback(OAUTH_PORT);
        openBrowser(authUrl);

        const { code } = await callbackPromise;

        const tokenRes = await exchangeCodeForToken(config, code, codeVerifier);
        await saveTokens(PLATFORM, setCred, tokenRes.access_token, tokenRes.refresh_token, tokenRes.expires_in);

        const profile = await this.fetchProfile(tokenRes.access_token);

        return {
            platform: this.name,
            authenticated: true,
            username: `@${profile.data?.username}`,
            scopes: config.scopes,
        };
    }

    async post(content: PostContent, getCred: CredentialGetter): Promise<PostResult> {
        const tokens = await getStoredTokens(PLATFORM, getCred);
        if (!tokens.accessToken) {
            return { success: false, platform: this.name, error: 'Not authenticated. Run social.auth first.', timestamp: new Date().toISOString() };
        }

        try {
            const text = this.formatText(content.text, 280, content.tags);

            const res = await fetch('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            if (!res.ok) {
                const errText = await res.text();
                return { success: false, platform: this.name, error: `X API error (${res.status}): ${errText}`, timestamp: new Date().toISOString() };
            }

            const result = await res.json() as any;
            return {
                success: true,
                platform: this.name,
                postId: result.data?.id,
                postUrl: `https://x.com/i/status/${result.data?.id}`,
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
            return { platform: this.name, authenticated: true, username: `@${profile.data?.username}`, expiresAt: tokens.expiresAt || undefined };
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
        const res = await fetch('https://api.twitter.com/2/users/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`X profile fetch failed: ${res.status}`);
        return res.json();
    }
}
