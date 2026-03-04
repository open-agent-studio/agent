# Agent Runtime — Complete Documentation

> Everything you need to know to install, configure, and use Agent Runtime effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Interactive Mode](#interactive-mode)
4. [Goals & Tasks](#goals--tasks)
5. [The Daemon](#the-daemon)
6. [Credential Vault](#credential-vault)
7. [Skills](#skills)
8. [Commands](#commands)
9. [Scripts](#scripts)
10. [Plugins](#plugins)
11. [Hooks](#hooks)
12. [Agent Studio](#agent-studio)
13. [Memory System](#memory-system)
14. [LLM Configuration](#llm-configuration)
15. [Tool Reference](#tool-reference)
16. [REST API Reference](#rest-api-reference)
17. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js 18+** — Required for running the agent
- **npm** — Comes with Node.js
- **An LLM API key** — OpenAI, Anthropic, or Azure OpenAI (or Ollama for local)

### Installation

```bash
npm install -g @praveencs/agent
```

### Initialize Your Project

Navigate to any project directory and run:

```bash
cd your-project
agent init
```

This creates a `.agent/` directory containing:
- `config.json` — Agent configuration (LLM provider, model, etc.)
- `skills/` — Your custom skill definitions
- `commands/` — Lightweight command templates
- `scripts/` — Automation scripts
- `hooks/` — Lifecycle hooks
- `plugins/` — Installed plugin bundles

### Set Your API Key

```bash
# Option 1: Environment variable
export OPENAI_API_KEY=sk-your-key-here

# Option 2: .env file in your project
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Option 3: Store in the encrypted vault
agent studio  # → Open Credentials page → Add Secret
```

### Verify Installation

```bash
agent doctor
```

This checks your Node version, LLM connectivity, and project configuration.

---

## Core Concepts

### What Is an Agent?

Unlike a chatbot where you send messages and wait for replies, an **agent** is proactive:

1. **You give it a goal** — "Build a dashboard with system monitoring"
2. **It plans** — The LLM decomposes your goal into subtasks with dependencies
3. **It executes** — Each task uses tools (file system, shell, HTTP, etc.)
4. **It adapts** — If something fails, it retries or re-plans
5. **It learns** — Successful patterns are saved to memory

### The Agent Components

| Component | Role |
|-----------|------|
| **CLI / REPL** | Your interface — type goals, run commands |
| **LLM Router** | Routes requests to OpenAI/Anthropic/Azure/Ollama |
| **Goal Store** | SQLite database of goals, tasks, and progress |
| **Daemon** | Background service that processes the task queue |
| **Tool Registry** | File system, shell, git, HTTP, secrets, scripts |
| **Policy Engine** | Controls what tools can execute, with approval gates |
| **Memory Store** | Persistent facts, learnings, and context |
| **Credential Vault** | Encrypted storage for API keys and tokens |
| **Skill/Command/Script Loaders** | Load extensible capabilities |
| **Plugin Loader** | Bundles of skills + commands + scripts + hooks |

### The Execution Flow

```
Goal → Decompose → Task Queue → Daemon picks task → Load tools + capabilities
  → Build prompt (inject context, capabilities, dependency outputs)
  → LLM decides which tools to call → Execute tools → Complete/Retry/Re-plan
```

---

## Interactive Mode

The **recommended** way to use Agent Runtime:

```bash
agent
```

You enter a conversational REPL where you can:
- Type natural language goals
- Use `/slash` commands
- Have multi-turn conversations with context memory

```
🤖 Agent Runtime v0.9.25
   Project: my-app │ Model: gpt-4o │ 3 skills │ 2 commands

> Refactor the auth module to use JWT tokens

  ⚡ fs.read(src/auth/handler.ts) ✓
  ⚡ fs.write(src/auth/jwt.ts) ✓
  ⚡ fs.write(src/auth/middleware.ts) ✓
  ⚡ cmd.run(npm test) ✓

  ✓ Done (12.3s)

> Now add refresh token support      ← Context is preserved!
```

### Slash Commands

| Command | Action |
|---------|--------|
| `/help` | Show all available commands |
| `/skills` | List installed skills with success metrics |
| `/commands` | List available command templates |
| `/scripts` | List available automation scripts |
| `/hooks` | Show registered lifecycle hooks |
| `/model` | Display current LLM provider and model |
| `/compact` | Summarize conversation to free context window |
| `/clear` | Clear the terminal |
| `/exit` | Exit the REPL |
| `/deploy-staging` | Custom commands are auto-available as slash commands |

---

## Goals & Tasks

### Creating Goals

```bash
# From CLI
agent goal add "Build a REST API for user management" --priority 1

# From interactive mode
> Create a complete CRUD API for users with authentication

# From Studio
# → Goals & Tasks page → "New Goal" button
```

### Auto-Decomposition

When you create a goal, the LLM automatically decomposes it into subtasks:

```
Goal: "Build a REST API for user management"
├── Task 1: Set up Express server and project structure
├── Task 2: Create User model with database schema (depends: 1)
├── Task 3: Implement CRUD endpoints (depends: 2)
├── Task 4: Add authentication middleware (depends: 1)
├── Task 5: Write integration tests (depends: 3, 4)
└── Task 6: Create API documentation (depends: 3)
```

Tasks have:
- **Dependencies** — Won't start until prerequisites complete
- **Retries** — Automatically retry up to 3 times on failure
- **Output chaining** — Each task's output is available to downstream tasks
- **Re-decomposition** — If a task permanently fails, the LLM suggests alternatives

### Monitoring Progress

```bash
agent goal list                # See all goals with progress
agent goal status 1            # Detailed task breakdown
agent daemon logs              # See what the daemon is doing
```

---

## The Daemon

The daemon is a background service that autonomously processes your task queue.

### Starting and Stopping

```bash
agent daemon start             # Launch the daemon
agent daemon stop              # Graceful shutdown
agent daemon status            # Health check
agent daemon logs              # View execution log
```

### What It Does

Every 2 minutes (configurable), the daemon:

1. **Checks for goals** that need decomposition
2. **Picks up pending tasks** respecting dependencies
3. **Runs up to 3 tasks in parallel** (configurable)
4. **For each task:**
   - Loads ALL project capabilities (skills, commands, scripts, plugins, credentials)
   - Builds a rich prompt with context from dependency outputs
   - Lets the LLM decide which tools to call
   - Executes tools and reports results
5. **On failure:**
   - Retries up to 3 times
   - If still failing, triggers LLM re-decomposition
   - Creates alternative subtasks to work around the problem
6. **On completion:**
   - Saves output for downstream tasks
   - Saves to memory for future context
   - Triggers processing of newly unblocked tasks

### Daemon Prompt Context

When executing a task, the daemon tells the LLM about:

```markdown
## Available Capabilities

### 🔑 Credentials (use secrets.get)
Available keys: GITHUB_TOKEN, APIFY_TOKEN, OPENAI_API_KEY

### 📜 Scripts (use script.run)
- update-dashboard: "Regenerates the dashboard"
- health-check: "Checks system health"

### 💻 Commands (use command.execute)
- deploy-staging: "Deploy to staging environment"

### 🔌 Plugins
- @agent/credentials: vault + capture (built-in)
```

This means the LLM **knows what's available** and reuses existing scripts/commands instead of recreating them.

---

## Credential Vault

### Overview

The agent has a secure credential store for API keys, tokens, and passwords. Credentials are:

- **Encrypted at rest** with AES-256-GCM
- **Machine-specific** — encryption key derived from hostname + project path
- **Auto-detected** from `.env` files
- **Never logged** — values are masked in all daemon output

### Storage Priority

When the LLM calls `secrets.get("GITHUB_TOKEN")`:

1. ✅ **Encrypted vault** (`.agent/vault.json`) — checked first
2. ✅ **`.env` file** — automatic fallback
3. ✅ **Environment variables** — system-level fallback
4. ❌ **Not found** — triggers interactive capture (via Studio)

### Managing Credentials

**Studio UI (recommended):**
1. Open Agent Studio (`agent studio`)
2. Click "Credentials" in the sidebar
3. Click "Add Secret"
4. Enter key name and value
5. Stored encrypted on disk

**`.env` file:**
```env
GITHUB_TOKEN=ghp_xxxx
OPENAI_API_KEY=sk-xxxx
APIFY_TOKEN=apify_api_xxxx
SMTP_HOST=smtp.gmail.com
```

**From the LLM (during task execution):**
```
secrets.get({ key: "GITHUB_TOKEN" })            → returns the value
secrets.list()                                    → returns key names
secrets.set({ key: "NEW_KEY", value: "xxx" })   → stores encrypted
```

---

## Skills

Skills are reusable AI capabilities. Each skill has:
- `skill.json` — Manifest with name, version, tools, permissions
- `prompt.md` — The LLM prompt that defines behavior

### Structure

```
.agent/skills/deploy-aws/
├── skill.json
└── prompt.md
```

**skill.json:**
```json
{
  "name": "deploy-aws",
  "version": "1.0.0",
  "description": "Deploy application to AWS",
  "inputs": {
    "region": { "type": "string", "required": true }
  },
  "tools": ["cmd.run", "fs.read", "secrets.get"],
  "permissions": { "required": ["exec", "secrets"] }
}
```

**prompt.md:**
```markdown
# Deploy to AWS

Deploy the application to {{region}} using the AWS CLI.
1. Check AWS credentials with `secrets.get`
2. Build the application
3. Deploy using `cmd.run`
```

### CLI Commands

```bash
agent skills list              # List with success metrics
agent skills create my-skill   # Scaffold a new skill
agent skills stats             # View performance data
agent skills doctor my-skill   # Diagnose failures
agent skills fix my-skill      # Auto-repair with LLM
```

---

## Commands

Commands are **lightweight goal templates** — just a markdown file.

### Create a Command

Create `.agent/commands/deploy-staging.md`:

```markdown
---
name: deploy-staging
description: Deploy current branch to staging
tools: [cmd.run, git.status]
---
# Deploy to Staging

1. Run `npm test` to verify all tests pass
2. Run `npm run build` to create production bundle
3. Run `git push origin HEAD:staging` to trigger deploy
```

### Use It

```bash
agent run deploy-staging       # From CLI
> /deploy-staging              # From interactive mode
```

The command's markdown body becomes the LLM prompt, with only the whitelisted tools available.

---

## Scripts

Scripts are **direct automation** — no LLM involved. Shell, Python, or Node.js.

### Create a Script

Create `.agent/scripts/health-check/`:

**script.yaml:**
```yaml
name: health-check
description: Check system health and report
entrypoint: run.sh
```

**run.sh:**
```bash
#!/bin/bash
echo "=== System Health ==="
echo "Hostname: $(hostname)"
echo "CPU: $(uptime)"
echo "Memory: $(free -h | head -2)"
echo "Disk: $(df -h / | tail -1)"
```

### Execute

```bash
agent scripts run health-check
```

The daemon can also execute scripts via the `script.run` tool during autonomous task execution.

---

## Plugins

Plugins bundle skills + commands + scripts + hooks into a distributable package.

### Structure

```
my-plugin/
├── plugin.json
├── skills/
│   └── security-scan/
├── commands/
│   └── audit.md
├── scripts/
│   └── check-deps/
└── hooks/
    └── hooks.json
```

**plugin.json:**
```json
{
  "name": "enterprise-security",
  "version": "1.0.0",
  "description": "Security scanning and compliance",
  "skills": ["skills/"],
  "commands": ["commands/"],
  "scripts": ["scripts/"],
  "hooks": "hooks/hooks.json"
}
```

### Install and Manage

Plugins can be installed locally from a path or remotely from the official **Agent Hub** (`praveencs87/agent-skills` repository).

```bash
# Install the official GitHub plugin from the Agent Hub
agent plugins install github

# Install a local plugin bundle
agent plugins install ./my-plugin

# List all installed plugins
agent plugins list

# Remove a plugin
agent plugins remove my-plugin
```

---

## Hooks

Hooks intercept agent execution at lifecycle events:

```json
{
  "hooks": {
    "after:tool": [{
      "match": "fs.write",
      "command": "npx prettier --write {{path}}",
      "blocking": false
    }],
    "before:plan": [{
      "command": "./scripts/validate-env.sh",
      "blocking": true
    }]
  }
}
```

### Available Events

| Event | When |
|-------|------|
| `before:tool` / `after:tool` | Before/after any tool executes |
| `before:plan` / `after:plan` | Before/after a plan runs |
| `after:step` | After each plan step |
| `before:skill` / `after:skill` | Around skill execution |
| `after:decompose` | After goal decomposition |
| `session:start` / `session:end` | At session boundaries |

---

## Agent Studio

The web-based management dashboard:

```bash
agent studio
# → Agent Studio running at http://localhost:3333
```

### Available Pages

| Page | Description |
|------|-------------|
| **Console** | Real-time terminal with live command relay and WebSocket streaming |
| **Capabilities** | View all loaded tools, permissions, and provider info |
| **Goals & Tasks** | Create goals, view decomposition, track progress with status badges |
| **Templates** | 6 pre-built goal templates with variable substitution |
| **Credentials** | Encrypted vault manager — add/delete/mask secrets |
| **Live Stream** | Real-time WebSocket streaming of tasks (`task:start`/`complete`) |
| **Skills** | CRUD for skill definitions, view success rates |
| **Commands** | View and manage command templates |
| **Scripts** | View script contents, run scripts, see output |
| **Plugins** | View installed plugins and their capabilities |
| **Daemon** | Start/stop daemon, view logs, check health |
| **Costs** | Monitor LLM token usage and spend per model |
| **Memory** | Search, add, and browse persistent agent memories |

---

## Memory System

The agent stores facts, learnings, and context in a SQLite database with FTS5 full-text search:

```bash
agent memory search "database credentials"
agent memory add "Staging server is at 10.0.0.5" --category fact
```

### Memory Categories

| Category | When Stored |
|----------|------------|
| `learned` | After successful task completion |
| `fact` | User-provided facts |
| `error` | Error patterns and their resolutions |
| `preference` | User preferences and conventions |

---

## LLM Configuration

### Supported Providers

| Provider | Env Variable | Example Models |
|----------|-------------|----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-sonnet, claude-3-opus |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | Any deployed model |
| Ollama | None (local at `http://localhost:11434`) | llama3, codellama, mistral |

### Fallback Chain

The LLM Router tries providers in order. If one fails, it falls back:

```
OpenAI → Anthropic → Azure → Ollama
```

Configure in `.agent/config.json`:
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "fallback": [
      { "provider": "anthropic", "model": "claude-3-sonnet-20240229" },
      { "provider": "ollama", "model": "llama3" }
    ]
  }
}
```

---

## Tool Reference

### File System

| Tool | Arguments | Description |
|------|-----------|-------------|
| `fs.read` | `{ path }` | Read file contents |
| `fs.write` | `{ path, content }` | Write/create file |
| `fs.mkdir` | `{ path }` | Create directory |
| `fs.list` | `{ path }` | List directory contents |
| `fs.stat` | `{ path }` | Get file metadata |

### Shell

| Tool | Arguments | Description |
|------|-----------|-------------|
| `cmd.run` | `{ command, cwd? }` | Execute shell command |

### Git

| Tool | Arguments | Description |
|------|-----------|-------------|
| `git.status` | — | Get git status |
| `git.diff` | `{ staged? }` | Show changes |
| `git.commit` | `{ message }` | Commit changes |

### Network

| Tool | Arguments | Description |
|------|-----------|-------------|
| `http.request` | `{ url, method?, headers?, body? }` | HTTP request (GET/POST/PUT/DELETE) |
| `notify.send` | `{ channel, title, message, ... }` | Send alerts via Slack/Discord, Email, or log |

### Cost & Tokens

| Tool | Arguments | Description |
|------|-----------|-------------|
| `cost.summary` | — | Get LLM token usage and spend summary |
| `cost.recent` | `{ limit? }` | View recent API calls and their costs |

### Credentials

| Tool | Arguments | Description |
|------|-----------|-------------|
| `secrets.get` | `{ key, reason? }` | Get a credential value |
| `secrets.list` | — | List known credential keys |
| `secrets.set` | `{ key, value }` | Store a credential |

### Automation

| Tool | Arguments | Description |
|------|-----------|-------------|
| `script.run` | `{ name, args? }` | Execute a project script |
| `command.execute` | `{ name }` | Run a project command |

---

## REST API Reference

Agent Studio exposes a REST API at `http://localhost:3333`:

### Instances

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances` | List all agent instances |
| GET | `/api/instances/:id/capabilities` | Get instance capabilities |

### Goals & Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances/:id/goals` | List goals |
| POST | `/api/instances/:id/goals` | Create a goal |
| GET | `/api/instances/:id/tasks` | List tasks |
| POST | `/api/instances/:id/tasks/:taskId/approve` | Approve a task |

### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances/:id/credentials` | List credential keys |
| POST | `/api/instances/:id/credentials` | Add a credential `{ key, value }` |
| DELETE | `/api/instances/:id/credentials/:key` | Delete a credential |

### Skills, Commands, Scripts, Plugins

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances/:id/skills` | List skills |
| GET | `/api/instances/:id/commands` | List commands |
| GET | `/api/instances/:id/scripts` | List scripts |
| GET | `/api/instances/:id/plugins` | List plugins |

### Cost Tracking & Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances/:id/costs/summary` | Get token usage and cost breakdown |
| GET | `/api/instances/:id/costs/recent` | Recent LLM API calls |
| GET | `/api/instances/:id/notifications` | Recent notification logs |

### Daemon

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instances/:id/daemon/status` | Daemon status |
| POST | `/api/instances/:id/daemon/start` | Start daemon |
| POST | `/api/instances/:id/daemon/stop` | Stop daemon |
| GET | `/api/instances/:id/daemon/logs` | Get daemon logs |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goal-templates` | Get pre-built goal templates |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe` | Client → Server | Subscribe to instance events |
| `agent:log` | Both | Real-time log streaming |
| `agent:command` | Both | Command relay |
| `agent:approval:request` | Server → Client | Task needs approval |
| `agent:approval:response` | Client → Server | User approves/rejects |
| `credential:required` | Server → Client | Daemon needs a credential |
| `credential:provide` | Client → Server | User provides credential |
| `task:progress` | Server → Client | Live task execution updates |

---

## Troubleshooting

### "No LLM provider available"

Your API keys aren't set. Fix with:
```bash
export OPENAI_API_KEY=sk-your-key
# or use .env file
# or add via Studio → Credentials
```

### Daemon tasks not starting

Check that your goal is `active` and tasks are `pending`:
```bash
agent goal list
agent goal status <id>
```

### "Permission denied" on tool execution

Your policy engine is blocking the tool. Set wildcard permissions for full autonomy:
```json
{
  "policy": {
    "permissions": ["*"]
  }
}
```

### Studio won't start

```bash
agent doctor           # Check system health
agent studio           # Try again — port 3333
```

### Daemon stuck on a task

```bash
agent daemon stop
agent daemon start     # Restart picks up where it left off
```
