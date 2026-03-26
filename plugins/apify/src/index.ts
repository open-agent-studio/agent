/**
 * @open-agent-studio/plugin-apify
 *
 * Official Apify integration plugin for Open Agent Studio.
 * Registers 8 tools into the Agent's ToolRegistry for managing
 * Actors, Datasets, Key-Value Stores, Schedules, and the Apify Store.
 *
 * Authentication: APIFY_API_TOKEN stored in the credential vault.
 */

import { ApifyClient, type CredentialGetter } from './client.js';
import { ActorsService } from './services/actors.js';
import { DatasetsService } from './services/datasets.js';
import { KeyValueStoreService } from './services/key-value-store.js';
import { SchedulesService } from './services/schedules.js';
import { StoreService } from './services/store.js';

// ─── Plugin Initialization ───

export function register(context: {
    getCredential: CredentialGetter;
    registerTool: (name: string, schema: any, handler: (args: any) => Promise<any>) => void;
}) {
    const { getCredential, registerTool } = context;
    const client = new ApifyClient(getCredential);
    const actors = new ActorsService(client);
    const datasets = new DatasetsService(client);
    const kvStore = new KeyValueStoreService(client);
    const schedules = new SchedulesService(client);
    const store = new StoreService(client);

    // ─── Tool 1: apify.run ───
    registerTool('apify.run', {
        name: 'apify.run',
        description: 'Run an Apify Actor with the given input. Returns the run ID and status. Use actorId like "apify/web-scraper" or a full Actor ID.',
        parameters: {
            type: 'object',
            properties: {
                actorId: { type: 'string', description: 'Actor ID or slug (e.g., "apify/web-scraper")' },
                input: { type: 'object', description: 'Input JSON for the Actor' },
                sync: { type: 'boolean', description: 'If true, wait for run to finish and return dataset items directly. Default: false' },
                timeoutSecs: { type: 'number', description: 'Max run duration in seconds' },
                memoryMbytes: { type: 'number', description: 'Memory allocation in MB (256, 512, 1024, 2048, 4096)' },
            },
            required: ['actorId'],
        },
    }, async (args: { actorId: string; input?: any; sync?: boolean; timeoutSecs?: number; memoryMbytes?: number }) => {
        if (args.sync) {
            const items = await actors.runSync(args.actorId, args.input);
            return {
                success: true,
                mode: 'sync',
                itemCount: items.length,
                items: items.slice(0, 50),
                note: items.length > 50 ? `Showing first 50 of ${items.length} items. Use apify.results to get all.` : undefined,
            };
        }

        const run = await actors.run(args.actorId, args.input, {
            timeoutSecs: args.timeoutSecs,
            memoryMbytes: args.memoryMbytes,
        });

        return {
            success: true,
            mode: 'async',
            runId: run.id,
            status: run.status,
            datasetId: run.defaultDatasetId,
            message: `Actor started. Use apify.status with runId "${run.id}" to check progress, or apify.results with datasetId "${run.defaultDatasetId}" to get results when done.`,
        };
    });

    // ─── Tool 2: apify.status ───
    registerTool('apify.status', {
        name: 'apify.status',
        description: 'Check the status of an Apify Actor run. Returns status, duration, and dataset ID.',
        parameters: {
            type: 'object',
            properties: {
                runId: { type: 'string', description: 'The run ID to check' },
            },
            required: ['runId'],
        },
    }, async (args: { runId: string }) => {
        const run = await actors.getRunStatus(args.runId);
        return {
            runId: run.id,
            status: run.status,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            datasetId: run.defaultDatasetId,
            kvStoreId: run.defaultKeyValueStoreId,
            durationMs: run.stats?.durationMillis,
            statusMessage: run.statusMessage,
        };
    });

    // ─── Tool 3: apify.results ───
    registerTool('apify.results', {
        name: 'apify.results',
        description: 'Get results/data from an Apify Actor run. Fetches items from the run\'s default dataset.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: { type: 'string', description: 'Dataset ID (from apify.run or apify.status response)' },
                limit: { type: 'number', description: 'Max items to return (default: 50)' },
                offset: { type: 'number', description: 'Items offset for pagination (default: 0)' },
                fields: { type: 'array', items: { type: 'string' }, description: 'Only return these fields' },
                format: { type: 'string', enum: ['json', 'csv'], description: 'Export format (default: json)' },
            },
            required: ['datasetId'],
        },
    }, async (args: { datasetId: string; limit?: number; offset?: number; fields?: string[]; format?: string }) => {
        if (args.format === 'csv') {
            const csv = await datasets.exportItems(args.datasetId, 'csv', args.limit || 1000);
            return { format: 'csv', data: csv };
        }

        const items = await datasets.getItems(args.datasetId, {
            limit: args.limit || 50,
            offset: args.offset || 0,
            fields: args.fields,
        });

        const info = await datasets.getInfo(args.datasetId);

        return {
            totalItems: info.itemCount,
            returnedItems: items.length,
            offset: args.offset || 0,
            items,
        };
    });

    // ─── Tool 4: apify.actors ───
    registerTool('apify.actors', {
        name: 'apify.actors',
        description: 'List the user\'s Apify Actors, or get details of a specific Actor.',
        parameters: {
            type: 'object',
            properties: {
                actorId: { type: 'string', description: 'Optional: Get details of a specific Actor' },
                limit: { type: 'number', description: 'Max Actors to list (default: 20)' },
            },
        },
    }, async (args: { actorId?: string; limit?: number }) => {
        if (args.actorId) {
            const actor = await actors.get(args.actorId);
            const runs = await actors.listRuns(args.actorId, 5);
            return { actor, recentRuns: runs.items };
        }

        const result = await actors.list(args.limit || 20);
        return {
            total: result.total,
            actors: result.items.map(a => ({
                id: a.id,
                name: a.name,
                title: a.title,
                description: a.description?.slice(0, 120),
            })),
        };
    });

    // ─── Tool 5: apify.store ───
    registerTool('apify.store', {
        name: 'apify.store',
        description: 'Search the Apify Store for public Actors. Use this to find scrapers, crawlers, and automation tools.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (e.g., "web scraper", "google maps", "twitter")' },
                limit: { type: 'number', description: 'Max results (default: 10)' },
            },
            required: ['query'],
        },
    }, async (args: { query: string; limit?: number }) => {
        const result = await store.search(args.query, args.limit || 10);
        return {
            total: result.total,
            actors: result.items.map(a => ({
                id: `${a.username}/${a.name}`,
                title: a.title,
                description: a.description?.slice(0, 150),
                totalRuns: a.stats?.totalRuns,
                totalUsers: a.stats?.totalUsers,
            })),
        };
    });

    // ─── Tool 6: apify.datasets ───
    registerTool('apify.datasets', {
        name: 'apify.datasets',
        description: 'List and manage Apify Datasets. View stored data from previous Actor runs.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'info', 'delete'], description: 'Action to perform (default: list)' },
                datasetId: { type: 'string', description: 'Dataset ID (required for info/delete)' },
                limit: { type: 'number', description: 'Max datasets to list (default: 20)' },
            },
        },
    }, async (args: { action?: string; datasetId?: string; limit?: number }) => {
        const action = args.action || 'list';

        if (action === 'info' && args.datasetId) {
            return await datasets.getInfo(args.datasetId);
        }

        if (action === 'delete' && args.datasetId) {
            await datasets.delete(args.datasetId);
            return { success: true, message: `Dataset ${args.datasetId} deleted.` };
        }

        const result = await datasets.list(args.limit || 20);
        return {
            total: result.total,
            datasets: result.items.map(d => ({
                id: d.id,
                name: d.name,
                itemCount: d.itemCount,
                modifiedAt: d.modifiedAt,
            })),
        };
    });

    // ─── Tool 7: apify.schedule ───
    registerTool('apify.schedule', {
        name: 'apify.schedule',
        description: 'Create and manage scheduled runs for Apify Actors using cron expressions.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'create', 'update', 'delete'], description: 'Action to perform' },
                scheduleId: { type: 'string', description: 'Schedule ID (for update/delete)' },
                actorId: { type: 'string', description: 'Actor ID (for create)' },
                cronExpression: { type: 'string', description: 'Cron expression, e.g., "0 9 * * 1-5" for weekdays at 9am' },
                name: { type: 'string', description: 'Schedule name' },
                input: { type: 'object', description: 'Actor input for the scheduled run' },
                isEnabled: { type: 'boolean', description: 'Enable/disable the schedule' },
            },
            required: ['action'],
        },
    }, async (args: {
        action: string;
        scheduleId?: string;
        actorId?: string;
        cronExpression?: string;
        name?: string;
        input?: any;
        isEnabled?: boolean;
    }) => {
        switch (args.action) {
            case 'list': {
                const result = await schedules.list();
                return {
                    total: result.total,
                    schedules: result.items.map(s => ({
                        id: s.id,
                        name: s.name,
                        cron: s.cronExpression,
                        enabled: s.isEnabled,
                        nextRun: s.nextRunAt,
                        lastRun: s.lastRunAt,
                    })),
                };
            }
            case 'create': {
                if (!args.actorId || !args.cronExpression) {
                    throw new Error('actorId and cronExpression are required to create a schedule');
                }
                const schedule = await schedules.create({
                    actorId: args.actorId,
                    cronExpression: args.cronExpression,
                    name: args.name,
                    isEnabled: args.isEnabled ?? true,
                    runInput: args.input,
                });
                return { success: true, schedule };
            }
            case 'update': {
                if (!args.scheduleId) throw new Error('scheduleId is required for update');
                const updated = await schedules.update(args.scheduleId, {
                    name: args.name,
                    cronExpression: args.cronExpression,
                    isEnabled: args.isEnabled,
                });
                return { success: true, schedule: updated };
            }
            case 'delete': {
                if (!args.scheduleId) throw new Error('scheduleId is required for delete');
                await schedules.delete(args.scheduleId);
                return { success: true, message: `Schedule ${args.scheduleId} deleted.` };
            }
            default:
                throw new Error(`Unknown action: ${args.action}`);
        }
    });

    // ─── Tool 8: apify.kv ───
    registerTool('apify.kv', {
        name: 'apify.kv',
        description: 'Read and write records in Apify Key-Value Stores. Useful for storing/retrieving configuration, screenshots, and other data.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'keys', 'get', 'set', 'delete'], description: 'Action to perform' },
                storeId: { type: 'string', description: 'Key-Value Store ID' },
                key: { type: 'string', description: 'Record key (for get/set/delete)' },
                value: { description: 'Value to store (for set action)' },
            },
            required: ['action'],
        },
    }, async (args: { action: string; storeId?: string; key?: string; value?: any }) => {
        switch (args.action) {
            case 'list': {
                const result = await kvStore.list();
                return {
                    total: result.total,
                    stores: result.items.map(s => ({
                        id: s.id,
                        name: s.name,
                        modifiedAt: s.modifiedAt,
                    })),
                };
            }
            case 'keys': {
                if (!args.storeId) throw new Error('storeId is required');
                const result = await kvStore.listKeys(args.storeId);
                return { keys: result.items };
            }
            case 'get': {
                if (!args.storeId || !args.key) throw new Error('storeId and key are required');
                const value = await kvStore.getRecord(args.storeId, args.key);
                return { key: args.key, value };
            }
            case 'set': {
                if (!args.storeId || !args.key) throw new Error('storeId and key are required');
                await kvStore.setRecord(args.storeId, args.key, args.value);
                return { success: true, message: `Key "${args.key}" stored successfully.` };
            }
            case 'delete': {
                if (!args.storeId || !args.key) throw new Error('storeId and key are required');
                await kvStore.deleteRecord(args.storeId, args.key);
                return { success: true, message: `Key "${args.key}" deleted.` };
            }
            default:
                throw new Error(`Unknown action: ${args.action}`);
        }
    });
}

// Re-export types
export { ApifyClient } from './client.js';
export { ActorsService, type ActorRun, type ActorInfo } from './services/actors.js';
export { DatasetsService, type DatasetInfo } from './services/datasets.js';
export { KeyValueStoreService, type KVStoreInfo } from './services/key-value-store.js';
export { SchedulesService, type ScheduleInfo } from './services/schedules.js';
export { StoreService, type StoreActor } from './services/store.js';
