# Configuration Reference

> Complete reference for all Agent Runtime configuration options.

---

## Configuration Files

The Agent Runtime loads configuration from these locations (in priority order):

1. **Project config**: `.agent/config.json` (project-specific)
2. **Global config**: `~/.agent/config.json` (user-wide defaults)
3. **Environment variables** (highest priority, override config files)

---

## Full Schema

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.2,
    "maxTokens": 4096,
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1"
  },

  "skills": {
    "installPaths": [".agent/skills"],
    "enableSelfImprovement": true,
    "metricsWindow": 20
  },

  "commands": {
    "installPaths": [".agent/commands"]
  },

  "scripts": {
    "installPaths": [".agent/scripts"]
  },

  "plugins": {
    "installPaths": [".agent/plugins"]
  },

  "hooks": {
    "path": ".agent/hooks/hooks.json"
  },

  "policy": {
    "autoAllow": ["fs.read", "fs.list", "project.detect"],
    "alwaysAsk": ["cmd.run", "fs.delete"],
    "denyList": []
  },

  "memory": {
    "enabled": true,
    "dbPath": ".agent/agent.db",
    "contextTokens": 500
  },

  "daemon": {
    "enabled": true,
    "pollIntervalMs": 5000,
    "maxConcurrentTasks": 1,
    "watch": [],
    "onFileChange": null
  },

  "studio": {
    "port": 3333
  },

  "cliTools": {
    "cursor": { "binary": "cursor", "available": false },
    "codex": { "binary": "codex", "available": false },
    "gemini": { "binary": "gemini", "available": false },
    "claude": { "binary": "claude", "available": false }
  },

  "reporting": {
    "enabled": true,
    "format": "markdown"
  }
}
```

---

## LLM Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `"openai"` | Provider: `openai`, `azure`, `anthropic`, `ollama` |
| `model` | string | `"gpt-4o"` | Model name to use |
| `temperature` | number | `0.2` | Response creativity (0.0–2.0) |
| `maxTokens` | number | `4096` | Maximum tokens per response |
| `apiKey` | string | — | API key (can use env var instead) |
| `baseUrl` | string | — | Custom API endpoint URL |

### Environment Variables

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI |

---

## Skills Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `installPaths` | string[] | `[".agent/skills"]` | Directories to scan for skills |
| `enableSelfImprovement` | boolean | `true` | Enable auto-fix for failing skills |
| `metricsWindow` | number | `20` | Number of recent executions to consider for metrics |

---

## Policy Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoAllow` | string[] | `[]` | Tools that skip approval |
| `alwaysAsk` | string[] | `[]` | Tools that always require approval |
| `denyList` | string[] | `[]` | Tool+args patterns to always deny |

---

## Memory Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable persistent memory |
| `dbPath` | string | `".agent/agent.db"` | SQLite database path |
| `contextTokens` | number | `500` | Max tokens of memory context per LLM call |

---

## Daemon Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Allow daemon to be started |
| `pollIntervalMs` | number | `5000` | How often to check for new tasks |
| `maxConcurrentTasks` | number | `1` | Max parallel task execution |
| `watch` | string[] | `[]` | File glob patterns to watch |
| `onFileChange` | string | — | Skill to trigger on file changes |

---

## Studio Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3333` | Port for the Studio web server |

---

## CLI Tools (Multi-CLI Orchestration)

| Field | Type | Description |
|-------|------|-------------|
| `binary` | string | Path or name of the CLI binary |
| `available` | boolean | Whether the CLI is available on this machine |

Supported CLIs: `cursor`, `codex`, `gemini`, `claude`

---

## Project Initialization

Generate a default configuration:

```bash
agent init
# Creates .agent/ directory with config.json, skills/, commands/, hooks/, scripts/
```

Or configure globally:

```bash
agent config --init
# Creates ~/.agent/config.json
```
