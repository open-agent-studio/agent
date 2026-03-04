import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { AgentConfigSchema, type AgentConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { getConfigPath, getGlobalAgentDir } from '../utils/paths.js';
import { validateSchema } from '../utils/schema.js';

/**
 * Configuration loader that merges global → project → env configs
 */
export class ConfigLoader {
    private config: AgentConfig | null = null;
    private configPath: string;

    constructor(configPath?: string) {
        this.configPath = configPath ?? getConfigPath();
    }

    /**
     * Load and merge configuration from all sources
     */
    async load(): Promise<AgentConfig> {
        // Start with defaults
        let merged: Record<string, unknown> = { ...DEFAULT_CONFIG };

        // Layer 1: Global config (~/.agent-runtime/agent.config.json)
        const globalConfig = await this.loadFile(
            path.join(getGlobalAgentDir(), 'agent.config.json')
        );
        if (globalConfig) {
            merged = this.deepMerge(merged, globalConfig);
        }

        // Layer 2: Project config
        const projectConfig = await this.loadFile(this.configPath);
        if (projectConfig) {
            merged = this.deepMerge(merged, projectConfig);
        }

        // Layer 3: Environment variable overrides
        merged = this.applyEnvOverrides(merged);

        // Validate merged config
        const result = validateSchema(AgentConfigSchema, merged, 'agent.config.json');
        if (!result.success) {
            throw new Error(`Invalid configuration:\n${result.errors.join('\n')}`);
        }

        this.config = result.data as AgentConfig;
        return this.config;
    }

    /**
     * Get the loaded config (throws if not loaded)
     */
    get(): AgentConfig {
        if (!this.config) {
            throw new Error('Config not loaded. Call load() first.');
        }
        return this.config;
    }

    /**
     * Get a specific config value by dot-notation path
     */
    getValue(keyPath: string): unknown {
        const config = this.get();
        const keys = keyPath.split('.');
        let current: unknown = config;
        for (const key of keys) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = (current as Record<string, unknown>)[key];
        }
        return current;
    }

    /**
     * Set a specific config value and save to project config
     */
    /**
     * Well-known shorthand keys → their actual nested config path
     */
    private static readonly KEY_ALIASES: Record<string, string> = {
        'OPENAI_API_KEY': 'models.providers.openai.apiKey',
        'ANTHROPIC_API_KEY': 'models.providers.anthropic.apiKey',
        'AZURE_API_KEY': 'models.providers.azure.apiKey',
        'AZURE_DEPLOYMENT_NAME': 'models.providers.azure.deploymentName',
        'DEFAULT_LLM_PROVIDER': 'models.routing.defaultProvider',
        'DEFAULT_MODEL_NAME': 'models.providers.openai.model',
        'APIFY_API_TOKEN': 'credentials.APIFY_API_TOKEN',
    };

    async setValue(keyPath: string, value: unknown): Promise<void> {
        // Resolve well-known shorthand aliases to their actual config paths
        const resolvedPath = ConfigLoader.KEY_ALIASES[keyPath] ?? keyPath;

        const config = this.get() as unknown as Record<string, unknown>;
        const keys = resolvedPath.split('.');
        let current = config;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key] as Record<string, unknown>;
        }
        current[keys[keys.length - 1]] = value;

        // Re-validate (skip validation for credential paths since they aren't in the schema)
        if (!resolvedPath.startsWith('credentials.')) {
            const result = validateSchema(AgentConfigSchema, config, 'agent.config.json');
            if (!result.success) {
                throw new Error(`Invalid config value:\n${result.errors.join('\n')}`);
            }
            this.config = result.data as AgentConfig;
        }

        await writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    }

    /**
     * Save current config to disk
     */
    async save(): Promise<void> {
        const config = this.get();
        await writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    }

    // ─── Private Helpers ───

    private async loadFile(filePath: string): Promise<Record<string, unknown> | null> {
        try {
            await access(filePath);
            const content = await readFile(filePath, 'utf-8');
            return JSON.parse(content) as Record<string, unknown>;
        } catch {
            return null;
        }
    }

    private applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
        const envMap: Record<string, string> = {
            // AGENT_-prefixed (original convention)
            'AGENT_OPENAI_API_KEY': 'models.providers.openai.apiKey',
            'AGENT_ANTHROPIC_API_KEY': 'models.providers.anthropic.apiKey',
            'AZURE_API_KEY': 'models.providers.azure.apiKey',
            'AZURE_API_BASE': 'models.providers.azure.baseUrl',
            'AZURE_DEPLOYMENT_NAME': 'models.providers.azure.deploymentName',
            'AZURE_API_VERSION': 'models.providers.azure.apiVersion',
            'AGENT_DEFAULT_PROVIDER': 'models.routing.defaultProvider',
            'AGENT_OFFLINE_FIRST': 'models.routing.offlineFirst',
            // Bare env var aliases (for .env compatibility)
            'OPENAI_API_KEY': 'models.providers.openai.apiKey',
            'ANTHROPIC_API_KEY': 'models.providers.anthropic.apiKey',
            'APIFY_API_TOKEN': 'credentials.APIFY_API_TOKEN',
        };

        for (const [envVar, configPath] of Object.entries(envMap)) {
            const value = process.env[envVar];
            if (value !== undefined) {
                const keys = configPath.split('.');
                let current = config;
                for (let i = 0; i < keys.length - 1; i++) {
                    const key = keys[i];
                    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
                        current[key] = {};
                    }
                    current = current[key] as Record<string, unknown>;
                }
                // Auto-parse booleans and numbers
                if (value === 'true') current[keys[keys.length - 1]] = true;
                else if (value === 'false') current[keys[keys.length - 1]] = false;
                else if (!isNaN(Number(value))) current[keys[keys.length - 1]] = Number(value);
                else current[keys[keys.length - 1]] = value;
            }
        }

        return config;
    }

    private deepMerge(
        target: Record<string, unknown>,
        source: Record<string, unknown>
    ): Record<string, unknown> {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                target[key] &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                result[key] = this.deepMerge(
                    target[key] as Record<string, unknown>,
                    source[key] as Record<string, unknown>
                );
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }
}
