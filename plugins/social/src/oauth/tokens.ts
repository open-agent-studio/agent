/**
 * Token Storage Helpers
 *
 * Manages reading/writing OAuth tokens via the Agent's CredentialStore.
 * All tokens are stored AES-256 encrypted in vault.json.
 */

import { credentialKey, type CredentialGetter, type CredentialSetter } from '../platforms/base.js';

export interface StoredTokens {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: string | null;
}

/**
 * Read stored tokens for a platform
 */
export async function getStoredTokens(platform: string, getCred: CredentialGetter): Promise<StoredTokens> {
    return {
        accessToken: await getCred(credentialKey(platform, 'ACCESS_TOKEN')),
        refreshToken: await getCred(credentialKey(platform, 'REFRESH_TOKEN')),
        expiresAt: await getCred(credentialKey(platform, 'EXPIRES_AT')),
    };
}

/**
 * Store tokens for a platform
 */
export async function saveTokens(
    platform: string,
    setCred: CredentialSetter,
    accessToken: string,
    refreshToken?: string,
    expiresInSeconds?: number,
): Promise<void> {
    await setCred(credentialKey(platform, 'ACCESS_TOKEN'), accessToken);

    if (refreshToken) {
        await setCred(credentialKey(platform, 'REFRESH_TOKEN'), refreshToken);
    }

    if (expiresInSeconds) {
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
        await setCred(credentialKey(platform, 'EXPIRES_AT'), expiresAt);
    }
}

/**
 * Check if the stored access token is expired
 */
export function isTokenExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false; // If no expiry set, assume valid
    return new Date(expiresAt).getTime() < Date.now();
}
