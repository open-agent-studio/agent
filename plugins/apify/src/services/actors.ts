/**
 * Actors Service
 *
 * Manage and execute Apify Actors via the REST API v2.
 * Supports async runs, sync runs (wait for results), abort, and run history.
 */

import { ApifyClient } from '../client.js';

export interface ActorRun {
    id: string;
    actId: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    buildId?: string;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
    statusMessage?: string;
    stats?: {
        durationMillis?: number;
        inputBodyLen?: number;
        resurrectCount?: number;
    };
}

export interface ActorInfo {
    id: string;
    name: string;
    username?: string;
    title?: string;
    description?: string;
    stats?: {
        totalRuns?: number;
        totalUsers?: number;
    };
    versions?: Array<{ versionNumber: string; buildTag?: string }>;
}

export class ActorsService {
    constructor(private client: ApifyClient) {}

    /**
     * List the user's Actors
     */
    async list(limit = 100, offset = 0): Promise<{ items: ActorInfo[]; total: number }> {
        const res = await this.client.get<{ data: { items: ActorInfo[]; total: number } }>(
            '/acts', { limit: String(limit), offset: String(offset) }
        );
        return res.data;
    }

    /**
     * Get details of a specific Actor
     */
    async get(actorId: string): Promise<ActorInfo> {
        const res = await this.client.get<{ data: ActorInfo }>(`/acts/${encodeURIComponent(actorId)}`);
        return res.data;
    }

    /**
     * Run an Actor asynchronously — returns immediately with run info
     */
    async run(actorId: string, input?: any, options?: {
        build?: string;
        timeoutSecs?: number;
        memoryMbytes?: number;
        waitForFinish?: number;
    }): Promise<ActorRun> {
        const params: Record<string, string> = {};
        if (options?.build) params.build = options.build;
        if (options?.timeoutSecs) params.timeout = String(options.timeoutSecs);
        if (options?.memoryMbytes) params.memory = String(options.memoryMbytes);
        if (options?.waitForFinish) params.waitForFinish = String(options.waitForFinish);

        const queryStr = Object.keys(params).length
            ? '?' + new URLSearchParams(params).toString()
            : '';

        const res = await this.client.post<{ data: ActorRun }>(
            `/acts/${encodeURIComponent(actorId)}/runs${queryStr}`,
            input
        );
        return res.data;
    }

    /**
     * Run an Actor and wait for it to finish (synchronous mode).
     * Returns the default dataset items directly.
     */
    async runSync(actorId: string, input?: any): Promise<any[]> {
        const token = await (this.client as any).getToken();
        const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: input ? JSON.stringify(input) : undefined,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Apify sync run failed (${res.status}): ${errText}`);
        }

        return res.json() as Promise<any[]>;
    }

    /**
     * Get the status of a specific run
     */
    async getRunStatus(runId: string): Promise<ActorRun> {
        const res = await this.client.get<{ data: ActorRun }>(`/actor-runs/${runId}`);
        return res.data;
    }

    /**
     * Abort a running Actor
     */
    async abortRun(runId: string): Promise<ActorRun> {
        const res = await this.client.post<{ data: ActorRun }>(`/actor-runs/${runId}/abort`);
        return res.data;
    }

    /**
     * List runs for a specific Actor
     */
    async listRuns(actorId: string, limit = 20): Promise<{ items: ActorRun[]; total: number }> {
        const res = await this.client.get<{ data: { items: ActorRun[]; total: number } }>(
            `/acts/${encodeURIComponent(actorId)}/runs`,
            { limit: String(limit), desc: '1' }
        );
        return res.data;
    }

    /**
     * Get the log of a specific run
     */
    async getRunLog(runId: string): Promise<string> {
        const token = await (this.client as any).getToken();
        const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/log?token=${token}`);
        if (!res.ok) throw new Error(`Failed to get run log: ${res.status}`);
        return res.text();
    }
}
