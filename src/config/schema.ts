import { z } from 'zod';

// ─── Model Provider Config ───
const ModelProviderSchema = z.object({
    type: z.enum(['openai', 'anthropic', 'ollama', 'azure']),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string(),
    maxTokens: z.number().default(4096),
    temperature: z.number().default(0.7),
    deploymentName: z.string().optional(),  // Azure deployment name
    apiVersion: z.string().optional(),       // Azure API version
});

const ModelRoutingSchema = z.object({
    defaultProvider: z.string().default('openai'),
    offlineFirst: z.boolean().default(false),
    fallbackChain: z.array(z.string()).default(['openai', 'anthropic', 'ollama']),
    skillOverrides: z.record(z.string(), z.string()).default({}),
});

// ─── Policy Config ───
const ApprovalRuleSchema = z.object({
    permission: z.string(),
    action: z.enum(['allow', 'deny', 'confirm']).default('confirm'),
    scope: z.string().optional(),
});

const PolicyConfigSchema = z.object({
    defaultApproval: z.enum(['allow', 'confirm', 'deny']).default('confirm'),
    rules: z.array(ApprovalRuleSchema).default([]),
    filesystemAllowlist: z.array(z.string()).default(['**/*']),
    commandAllowlist: z.array(z.string()).default([]),
    domainAllowlist: z.array(z.string()).default([]),
});

// ─── Tool Config ───
const ToolConfigSchema = z.object({
    enabled: z.array(z.string()).default(['fs.*', 'cmd.run', 'git.*', 'project.detect']),
    plugins: z.array(z.string()).default([]),
    timeoutMs: z.number().default(30000),
    maxRetries: z.number().default(2),
    resourceLimits: z.object({
        maxDiskWriteMb: z.number().default(100),
        maxCpuSeconds: z.number().default(60),
        maxMemoryMb: z.number().default(512),
    }).default({}),
});

// ─── Hook Config ───
const HookConfigSchema = z.object({
    enabled: z.boolean().default(true),
    hooksPath: z.string().default('.agent/hooks'),
    timeout: z.number().default(10000),
});

// ─── CLI Tools Config ───
const CLIToolEntrySchema = z.object({
    binary: z.string(),
    available: z.boolean().default(false),
});

const CLIToolsConfigSchema = z.object({
    cursor: CLIToolEntrySchema.default({ binary: 'cursor', available: false }),
    codex: CLIToolEntrySchema.default({ binary: 'codex', available: false }),
    gemini: CLIToolEntrySchema.default({ binary: 'gemini', available: false }),
    claude: CLIToolEntrySchema.default({ binary: 'claude', available: false }),
});

// ─── Plugins Config ───
const PluginsConfigSchema = z.object({
    installPaths: z.array(z.string()).default(['.agent/plugins']),
    autoLoad: z.boolean().default(true),
});

// ─── Script Config ───
const ScriptConfigSchema = z.object({
    installPaths: z.array(z.string()).default(['.agent/scripts']),
});

// ─── Skill Config ───
const SkillConfigSchema = z.object({
    installPaths: z.array(z.string()).default(['.agent/skills']),
    registryUrl: z.string().default('https://raw.githubusercontent.com/praveencs87/agent-skills/main'),
});

// ─── Daemon Config ───
const DaemonConfigSchema = z.object({
    timezone: z.string().default('UTC'),
    watcherDebounceMs: z.number().default(500),
    pidFile: z.string().default('.agent/daemon.pid'),
});

// ─── MCP Config ───
const McpConfigSchema = z.object({
    stdio: z.boolean().default(true),
    http: z.object({
        enabled: z.boolean().default(false),
        host: z.string().default('127.0.0.1'),
        port: z.number().default(3100),
    }).default({}),
    exposedTools: z.array(z.string()).default([
        'skills.list', 'skills.run',
        'plans.list', 'plans.propose', 'plans.run',
    ]),
    gatedTools: z.array(z.string()).default([
        'fs.read', 'fs.search', 'git.diff', 'cmd.run',
    ]),
});

// ─── Embedding Config ───
const EmbeddingConfigSchema = z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['openai', 'azure', 'ollama']).default('openai'),
    model: z.string().default('text-embedding-3-small'),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    deploymentName: z.string().optional(),
    apiVersion: z.string().optional(),
});

// ─── Sandbox Config ───
const SandboxMountSchema = z.object({
    hostPath: z.string(),
    containerPath: z.string(),
    readOnly: z.boolean().optional().default(false),
});

const SandboxConfigSchema = z.object({
    enabled: z.boolean().default(false),
    image: z.string().default('node:20-slim'),
    timeout: z.number().default(60000),
    mounts: z.array(SandboxMountSchema).default([
        { hostPath: '.', containerPath: '/project', readOnly: false },
    ]),
    network: z.enum(['bridge', 'host', 'none']).default('bridge'),
    autoDestroy: z.boolean().default(true),
});

// ─── Swarm Config ───
const SwarmConfigSchema = z.object({
    enabled: z.boolean().default(false),
    maxAgents: z.number().default(5),
    model: z.string().default('gpt-4o'),
    allowDelegation: z.boolean().default(true),
    maxDelegationDepth: z.number().default(3),
    agentTimeout: z.number().default(120000),
});

// ─── Desktop Config ───
const DesktopConfigSchema = z.object({
    enabled: z.boolean().default(false),
    screenshotFormat: z.enum(['png', 'jpg']).default('png'),
    screenshotQuality: z.number().default(80),
    actionDelay: z.number().default(100),
    ocrEnabled: z.boolean().default(false),
    tempDir: z.string().default('/tmp/agent-desktop'),
});

// ─── Multimodal Config ───
const MultimodalConfigSchema = z.object({
    enabled: z.boolean().default(false),
    voice: z.object({
        model: z.string().default('whisper-1'),
        language: z.string().optional(),
        format: z.enum(['wav', 'mp3', 'webm']).default('wav'),
    }).default({}),
    vision: z.object({
        model: z.string().default('gpt-4o'),
        maxTokens: z.number().default(1024),
        detail: z.enum(['low', 'high', 'auto']).default('auto'),
    }).default({}),
    tts: z.object({
        model: z.string().default('tts-1'),
        voice: z.string().default('alloy'),
        format: z.enum(['mp3', 'opus', 'aac', 'flac']).default('mp3'),
        speed: z.number().default(1.0),
    }).default({}),
});

// ─── Full Config ───
export const AgentConfigSchema = z.object({
    $schema: z.string().optional(),
    models: z.object({
        providers: z.record(z.string(), ModelProviderSchema).default({
            openai: { type: 'openai', model: 'gpt-4o' },
        }),
        routing: ModelRoutingSchema.default({}),
        embeddings: EmbeddingConfigSchema.default({}),
    }).default({}),
    policy: PolicyConfigSchema.default({}),
    tools: ToolConfigSchema.default({}),
    hooks: HookConfigSchema.default({}),
    plugins: PluginsConfigSchema.default({}),
    cliTools: CLIToolsConfigSchema.default({}),
    scripts: ScriptConfigSchema.default({}),
    skills: SkillConfigSchema.default({}),
    daemon: DaemonConfigSchema.default({}),
    mcp: McpConfigSchema.default({}),
    sandbox: SandboxConfigSchema.default({}),
    swarm: SwarmConfigSchema.default({}),
    desktop: DesktopConfigSchema.default({}),
    multimodal: MultimodalConfigSchema.default({}),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;
