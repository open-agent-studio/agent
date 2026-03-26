/**
 * Apify API Client
 *
 * Lightweight HTTP wrapper for the Apify REST API v2.
 * Uses Bearer token authentication from the credential vault.
 *
 * Base URL: https://api.apify.com/v2
 * Auth: APIFY_API_TOKEN stored in CredentialStore
 * Docs: https://docs.apify.com/api/v2
 */

const BASE_URL = 'https://api.apify.com/v2';

export type CredentialGetter = (key: string) => Promise<string | null>;

export class ApifyClient {
    private getCredential: CredentialGetter;

    constructor(getCredential: CredentialGetter) {
        this.getCredential = getCredential;
    }

    private async getToken(): Promise<string> {
        const token = await this.getCredential('APIFY_API_TOKEN');
        if (!token) throw new Error('Missing APIFY_API_TOKEN. Run: agent credentials set APIFY_API_TOKEN "your-token"');
        return token;
    }

    async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
        const token = await this.getToken();
        const url = new URL(`${BASE_URL}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }

        const res = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Apify API error (${res.status} ${path}): ${errText}`);
        }

        return res.json() as Promise<T>;
    }

    async post<T = any>(path: string, body?: any): Promise<T> {
        const token = await this.getToken();
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Apify API error (${res.status} POST ${path}): ${errText}`);
        }

        return res.json() as Promise<T>;
    }

    async put<T = any>(path: string, body?: any): Promise<T> {
        const token = await this.getToken();
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Apify API error (${res.status} PUT ${path}): ${errText}`);
        }

        return res.json() as Promise<T>;
    }

    async del<T = any>(path: string): Promise<T> {
        const token = await this.getToken();
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Apify API error (${res.status} DELETE ${path}): ${errText}`);
        }

        // DELETE may return empty body
        const text = await res.text();
        return text ? JSON.parse(text) : ({} as T);
    }
}
