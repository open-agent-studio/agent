/**
 * Datasets Service
 *
 * Manage Apify Datasets — structured, append-only storage for scraped data.
 * Supports listing, reading items, pushing items, and exporting.
 */

import { ApifyClient } from '../client.js';

export interface DatasetInfo {
    id: string;
    name?: string;
    createdAt: string;
    modifiedAt: string;
    itemCount: number;
    cleanItemCount?: number;
}

export interface DatasetItemsOptions {
    offset?: number;
    limit?: number;
    fields?: string[];
    omit?: string[];
    clean?: boolean;
    format?: 'json' | 'csv' | 'xml' | 'html' | 'xlsx';
}

export class DatasetsService {
    constructor(private client: ApifyClient) {}

    /**
     * List all datasets
     */
    async list(limit = 100): Promise<{ items: DatasetInfo[]; total: number }> {
        const res = await this.client.get<{ data: { items: DatasetInfo[]; total: number } }>(
            '/datasets', { limit: String(limit) }
        );
        return res.data;
    }

    /**
     * Get dataset metadata
     */
    async getInfo(datasetId: string): Promise<DatasetInfo> {
        const res = await this.client.get<{ data: DatasetInfo }>(`/datasets/${datasetId}`);
        return res.data;
    }

    /**
     * Get items from a dataset
     */
    async getItems(datasetId: string, options?: DatasetItemsOptions): Promise<any[]> {
        const params: Record<string, string> = {};
        if (options?.offset !== undefined) params.offset = String(options.offset);
        if (options?.limit !== undefined) params.limit = String(options.limit);
        if (options?.fields) params.fields = options.fields.join(',');
        if (options?.omit) params.omit = options.omit.join(',');
        if (options?.clean) params.clean = 'true';

        const res = await this.client.get<any[]>(`/datasets/${datasetId}/items`, params);
        return Array.isArray(res) ? res : [];
    }

    /**
     * Push items to a dataset
     */
    async pushItems(datasetId: string, items: any[]): Promise<void> {
        await this.client.post(`/datasets/${datasetId}/items`, items);
    }

    /**
     * Export dataset as a specific format (returns raw text/data)
     */
    async exportItems(datasetId: string, format: string = 'json', limit = 1000): Promise<string> {
        const token = await (this.client as any).getToken();
        const url = `https://api.apify.com/v2/datasets/${datasetId}/items?format=${format}&limit=${limit}&token=${token}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Dataset export failed: ${res.status}`);
        return res.text();
    }

    /**
     * Delete a dataset
     */
    async delete(datasetId: string): Promise<void> {
        await this.client.del(`/datasets/${datasetId}`);
    }
}
