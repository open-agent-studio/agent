/**
 * Schedules Service
 *
 * Create and manage cron-based schedules for Apify Actor runs.
 */

import { ApifyClient } from '../client.js';

export interface ScheduleInfo {
    id: string;
    name?: string;
    cronExpression: string;
    isEnabled: boolean;
    isExclusive: boolean;
    createdAt: string;
    modifiedAt: string;
    nextRunAt?: string;
    lastRunAt?: string;
    actions: Array<{
        type: string;
        actorId?: string;
        runInput?: any;
    }>;
}

export interface CreateScheduleOptions {
    name?: string;
    cronExpression: string;
    isEnabled?: boolean;
    isExclusive?: boolean;
    actorId: string;
    runInput?: any;
    timeoutSecs?: number;
    memoryMbytes?: number;
}

export class SchedulesService {
    constructor(private client: ApifyClient) {}

    /**
     * List all schedules
     */
    async list(limit = 100): Promise<{ items: ScheduleInfo[]; total: number }> {
        const res = await this.client.get<{ data: { items: ScheduleInfo[]; total: number } }>(
            '/schedules', { limit: String(limit) }
        );
        return res.data;
    }

    /**
     * Get schedule details
     */
    async get(scheduleId: string): Promise<ScheduleInfo> {
        const res = await this.client.get<{ data: ScheduleInfo }>(`/schedules/${scheduleId}`);
        return res.data;
    }

    /**
     * Create a new schedule
     */
    async create(options: CreateScheduleOptions): Promise<ScheduleInfo> {
        const body = {
            name: options.name,
            cronExpression: options.cronExpression,
            isEnabled: options.isEnabled ?? true,
            isExclusive: options.isExclusive ?? false,
            actions: [{
                type: 'RUN_ACTOR',
                actorId: options.actorId,
                runInput: {
                    body: JSON.stringify(options.runInput || {}),
                    contentType: 'application/json; charset=utf-8',
                },
            }],
        };

        const res = await this.client.post<{ data: ScheduleInfo }>('/schedules', body);
        return res.data;
    }

    /**
     * Update a schedule
     */
    async update(scheduleId: string, updates: Partial<{
        name: string;
        cronExpression: string;
        isEnabled: boolean;
    }>): Promise<ScheduleInfo> {
        const res = await this.client.put<{ data: ScheduleInfo }>(`/schedules/${scheduleId}`, updates);
        return res.data;
    }

    /**
     * Delete a schedule
     */
    async delete(scheduleId: string): Promise<void> {
        await this.client.del(`/schedules/${scheduleId}`);
    }
}
