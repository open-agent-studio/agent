/**
 * Key-Value Store Service
 *
 * Manage Apify Key-Value Stores — flexible storage for JSON, HTML, images, etc.
 * Each Actor run gets its own default KV store.
 */

import { ApifyClient } from '../client.js';

export interface KVStoreInfo {
    id: string;
    name?: string;
    createdAt: string;
    modifiedAt: string;
}

export interface KVStoreKey {
    key: string;
    size: number;
}

export class KeyValueStoreService {
    constructor(private client: ApifyClient) {}

    /**
     * List all key-value stores
     */
    async list(limit = 100): Promise<{ items: KVStoreInfo[]; total: number }> {
        const res = await this.client.get<{ data: { items: KVStoreInfo[]; total: number } }>(
            '/key-value-stores', { limit: String(limit) }
        );
        return res.data;
    }

    /**
     * Get store metadata
     */
    async getInfo(storeId: string): Promise<KVStoreInfo> {
        const res = await this.client.get<{ data: KVStoreInfo }>(`/key-value-stores/${storeId}`);
        return res.data;
    }

    /**
     * List all keys in a store
     */
    async listKeys(storeId: string, limit = 1000): Promise<{ items: KVStoreKey[] }> {
        const res = await this.client.get<{ data: { items: KVStoreKey[] } }>(
            `/key-value-stores/${storeId}/keys`, { limit: String(limit) }
        );
        return res.data;
    }

    /**
     * Get a record by key
     */
    async getRecord(storeId: string, key: string): Promise<any> {
        const token = await (this.client as any).getToken();
        const res = await fetch(
            `https://api.apify.com/v2/key-value-stores/${storeId}/records/${encodeURIComponent(key)}?token=${token}`
        );
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`KV get failed (${res.status}): ${await res.text()}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return res.json();
        return res.text();
    }

    /**
     * Set/update a record
     */
    async setRecord(storeId: string, key: string, value: any, contentType = 'application/json'): Promise<void> {
        const token = await (this.client as any).getToken();
        const body = contentType.includes('json') ? JSON.stringify(value) : String(value);

        const res = await fetch(
            `https://api.apify.com/v2/key-value-stores/${storeId}/records/${encodeURIComponent(key)}?token=${token}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body,
            }
        );
        if (!res.ok) throw new Error(`KV set failed (${res.status}): ${await res.text()}`);
    }

    /**
     * Delete a record
     */
    async deleteRecord(storeId: string, key: string): Promise<void> {
        const token = await (this.client as any).getToken();
        const res = await fetch(
            `https://api.apify.com/v2/key-value-stores/${storeId}/records/${encodeURIComponent(key)}?token=${token}`,
            { method: 'DELETE' }
        );
        if (!res.ok) throw new Error(`KV delete failed (${res.status}): ${await res.text()}`);
    }
}
