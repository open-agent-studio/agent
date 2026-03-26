/**
 * Store Discovery Service
 *
 * Browse the Apify Store — search for public Actors, get categories, and discover tools.
 */

import { ApifyClient } from '../client.js';

export interface StoreActor {
    id: string;
    name: string;
    username: string;
    title: string;
    description: string;
    stats: {
        totalRuns?: number;
        totalUsers?: number;
        totalBuilds?: number;
    };
    currentPricingInfo?: {
        pricingModel?: string;
    };
    categories?: string[];
    pictureUrl?: string;
}

export class StoreService {
    constructor(private client: ApifyClient) {}

    /**
     * Search the Apify Store for public Actors
     */
    async search(query: string, limit = 20): Promise<{ items: StoreActor[]; total: number }> {
        const res = await this.client.get<{ data: { items: StoreActor[]; total: number } }>(
            '/store', { search: query, limit: String(limit) }
        );
        return res.data;
    }

    /**
     * Get details of a public Actor from the store
     */
    async getActor(actorId: string): Promise<StoreActor> {
        const res = await this.client.get<{ data: StoreActor }>(`/acts/${encodeURIComponent(actorId)}`);
        return res.data;
    }

    /**
     * List popular/featured Actors from the store
     */
    async listPopular(limit = 20): Promise<{ items: StoreActor[]; total: number }> {
        const res = await this.client.get<{ data: { items: StoreActor[]; total: number } }>(
            '/store', { limit: String(limit), sortBy: 'popularity' }
        );
        return res.data;
    }
}
