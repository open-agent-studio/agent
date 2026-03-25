/**
 * OAuth 2.0 Flow Manager
 *
 * Handles the complete OAuth 2.0 authorization code flow:
 * 1. Generate auth URL with PKCE (when supported)
 * 2. Exchange code for tokens
 * 3. Refresh expired tokens
 */

import { randomBytes, createHash } from 'node:crypto';
import type { OAuthConfig } from '../platforms/base.js';

// ─── PKCE ───

export function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

// ─── Auth URL ───

export interface AuthUrlParams {
    config: OAuthConfig;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    extraParams?: Record<string, string>;
}

export function buildAuthUrl(params: AuthUrlParams): string {
    const { config, state, codeChallenge, codeChallengeMethod, extraParams } = params;

    const url = new URL(config.authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));

    if (state) url.searchParams.set('state', state);
    if (codeChallenge) {
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', codeChallengeMethod || 'S256');
    }
    if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
            url.searchParams.set(k, v);
        }
    }

    return url.toString();
}

// ─── Token Exchange ───

export interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
}

export async function exchangeCodeForToken(
    config: OAuthConfig,
    code: string,
    codeVerifier?: string,
): Promise<TokenResponse> {
    const body: Record<string, string> = {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
    };

    if (codeVerifier) {
        body.code_verifier = codeVerifier;
    }

    const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Token exchange failed (${res.status}): ${errText}`);
    }

    return res.json() as Promise<TokenResponse>;
}

// ─── Token Refresh ───

export async function refreshAccessToken(
    config: OAuthConfig,
    refreshToken: string,
): Promise<TokenResponse> {
    const body: Record<string, string> = {
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
    };

    const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Token refresh failed (${res.status}): ${errText}`);
    }

    return res.json() as Promise<TokenResponse>;
}
