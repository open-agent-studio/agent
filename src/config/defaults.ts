import type { AgentConfig } from './schema.js';

export const DEFAULT_CONFIG: AgentConfig = {
    models: {
        providers: {
            azure: {
                type: 'azure',
                model: 'gpt-5-mini',
                deploymentName: 'gpt-5-mini',
                baseUrl: 'https://mercuri-openai.openai.azure.com',
                apiVersion: '2024-02-15-preview',
                maxTokens: 4096,
                temperature: 0.7,
            },
            openai: {
                type: 'openai',
                model: 'gpt-4o',
                maxTokens: 4096,
                temperature: 0.7,
            },
        },
        routing: {
            defaultProvider: 'azure',
            offlineFirst: false,
            fallbackChain: ['azure', 'openai', 'anthropic', 'ollama'],
            skillOverrides: {},
        },
        embeddings: {
            enabled: false,
            provider: 'openai',
            model: 'text-embedding-3-small',
        },
    },
    policy: {
        defaultApproval: 'confirm',
        rules: [
            { permission: 'filesystem.read', action: 'allow' },
            { permission: 'filesystem.write', action: 'confirm' },
            { permission: 'exec', action: 'confirm' },
            { permission: 'network', action: 'confirm' },
            { permission: 'ui_automation', action: 'confirm' },
            { permission: 'secrets', action: 'deny' },
        ],
        filesystemAllowlist: ['**/*'],
        commandAllowlist: [],
        domainAllowlist: [],
    },
    tools: {
        enabled: ['fs.*', 'cmd.run', 'git.*', 'project.detect'],
        plugins: [],
        timeoutMs: 30000,
        maxRetries: 2,
        resourceLimits: {
            maxDiskWriteMb: 100,
            maxCpuSeconds: 60,
            maxMemoryMb: 512,
        },
    },
    hooks: {
        enabled: true,
        hooksPath: '.agent/hooks',
        timeout: 10000,
    },
    plugins: {
        installPaths: ['.agent/plugins'],
        autoLoad: true,
    },
    scripts: {
        installPaths: ['.agent/scripts'],
    },
    cliTools: {
        cursor: { binary: 'cursor', available: false },
        codex: { binary: 'codex', available: false },
        gemini: { binary: 'gemini', available: false },
        claude: { binary: 'claude', available: false },
    },
    skills: {
        installPaths: ['.agent/skills'],
        registryUrl: 'https://raw.githubusercontent.com/praveencs87/agent-skills/main',
    },
    daemon: {
        timezone: 'UTC',
        watcherDebounceMs: 500,
        pidFile: '.agent/daemon.pid',
    },
    mcp: {
        stdio: true,
        http: {
            enabled: false,
            host: '127.0.0.1',
            port: 3100,
        },
        exposedTools: [
            'skills.list', 'skills.run',
            'plans.list', 'plans.propose', 'plans.run',
        ],
        gatedTools: [
            'fs.read', 'fs.search', 'git.diff', 'cmd.run',
        ],
    },
};
