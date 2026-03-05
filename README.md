# 🤖 Agent Runtime

> **Your autonomous AI employee.** Give it a goal, walk away. It decomposes, executes, scripts, and learns — all by itself.

[![npm version](https://img.shields.io/npm/v/@praveencs/agent)](https://www.npmjs.com/package/@praveencs/agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```
$ npm install -g @praveencs/agent
$ agent init
$ agent

  🤖 Agent Runtime v0.9.25
  > Build a system health dashboard with monitoring scripts

  🧠 Decomposing into 5 subtasks...
  ⚡ [1/5] Create project structure ✓
  ⚡ [2/5] Gather system data ✓        ← created .agent/scripts/system-info/
  ⚡ [3/5] Build HTML dashboard ✓      ← created dashboard.html + dashboard.css
  ⚡ [4/5] Create update script ✓      ← created .agent/scripts/update-dashboard/
  ⚡ [5/5] Write README ✓

  ✓ Goal completed (42.1s) — 5/5 tasks done
```

---

## What Is This?

Agent Runtime is a **fully autonomous AI coding agent** that runs on your machine. Unlike chat-based tools where you prompt-and-wait, this agent:

1. **Breaks down complex goals** into a dependency-aware task graph
2. **Runs tasks in parallel** (up to 3 at once) with automatic retries
3. **Creates scripts and files** autonomously — shell, Python, Node.js
4. **Uses your credentials** securely from an encrypted vault
5. **Re-plans on failure** — if a task fails, the LLM suggests alternatives
6. **Remembers everything** — persistent SQLite memory across sessions
7. **Tracks costs & notifies** — logs token usage/cost and sends Slack/email alerts
8. **Has a web dashboard** — Agent Studio for visual management, locally or via remote URL

Think of it as a **junior developer you can assign tasks to** and check on later.

---

## 🚀 Quick Start (5 minutes)

### 1. Install

```bash
npm install -g @praveencs/agent
```

### 2. Initialize a project

```bash
cd your-project
agent init
```

This creates a `.agent/` directory with configuration, skills, commands, and scripts.

### 3. Configure your LLM

```bash
# Set your preferred LLM provider
export OPENAI_API_KEY=sk-...
# OR
export ANTHROPIC_API_KEY=sk-ant-...
```

The agent supports **OpenAI**, **Anthropic**, **Azure OpenAI**, and **Ollama** (local) with automatic fallback.

### 4. Start using it

```bash
# Interactive mode (recommended)
agent

# Or one-shot command
agent run "Add input validation to the signup form"

# Or start the background daemon
agent daemon start
```

---

## 📖 How It Works

### The Agent Loop

```
You give a goal
     ↓
🧠 LLM decomposes it into subtasks with dependencies
     ↓
⚡ Daemon picks up tasks (up to 3 in parallel)
     ↓
🔧 Each task uses tools: file system, shell, git, HTTP, scripts, credentials
     ↓
✅ On success → saves output, triggers dependent tasks
❌ On failure → retries 3x, then re-decomposes with LLM
     ↓
💾 Everything stored in memory for future context
```

### Tool Ecosystem

The agent has access to these tools when executing tasks:

| Tool | What It Does |
|------|-------------|
| `fs.read` / `fs.write` | Read and write files |
| `fs.mkdir` / `fs.list` | Create directories, list contents |
| `cmd.run` | Execute shell commands |
| `git.status` / `git.diff` / `git.commit` | Git operations |
| `http.request` | Make HTTP API calls (GET/POST/PUT/DELETE) |
| `secrets.get` / `secrets.list` | Access encrypted credentials |
| `script.run` | Execute project scripts by name |
| `command.execute` | Run pre-defined command workflows |
| `notify.send` | Send alerts via webhook, email, or log |
| `cost.summary` | Get token usage and cost tracking |

---

## 🎯 Goal-Driven Autonomy

### Creating Goals

```bash
# From CLI
agent goal add "Build authentication with OAuth2" --priority 1

# The LLM auto-decomposes it:
# Task 1: Set up OAuth2 dependencies
# Task 2: Create auth routes (depends on: 1)
# Task 3: Implement token exchange (depends on: 1)
# Task 4: Add middleware (depends on: 2, 3)
# Task 5: Write tests (depends on: 4)
```

### The Daemon

The daemon is the heart of autonomous execution. It runs in the background and:

- Picks up pending tasks from the queue
- Runs **up to 3 tasks in parallel** (independent tasks only)
- **Chains outputs** — downstream tasks get results from their dependencies
- **Re-plans on failure** — uses LLM to suggest alternative approaches
- Loads **all project capabilities** — skills, scripts, commands, plugins, credentials

```bash
agent daemon start        # Start background processing
agent daemon status       # Check health & progress
agent daemon logs         # View execution log
agent daemon stop         # Graceful shutdown
```

### Example Daemon Log

```
🧠 Auto-decomposing goal #1: "Build data pipeline for GitHub API"
   ✅ Created 5 subtask(s)
🔄 Processing task #1: "Fetch trending repos" 
   📦 Loaded: 2 skills, 3 commands, 6 scripts, 1 plugin, 8 credentials
✅ Task #1 completed
🔄 Processing task #2: "Transform JSON response" [parallel: 2]
🔄 Processing task #3: "Save to file" [parallel: 3]
✅ Task #2 completed
✅ Task #3 completed
🔄 Processing task #4: "Create re-run script"
✅ Task #4 completed — Goal 100% complete
```

---

## 🔑 Credential Vault

The agent has a built-in **encrypted credential store** so it can use API keys, tokens, and passwords securely.

### How It Works

1. **Vault** — Secrets stored in `.agent/vault.json`, encrypted with AES-256-GCM
2. **`.env` fallback** — Credentials from `.env` are auto-detected
3. **Interactive capture** — If the agent needs a credential it doesn't have, it asks you via Studio

### Adding Credentials

**Via Studio UI:**
1. Open Agent Studio → Credentials
2. Click "Add Secret"
3. Enter key name (e.g., `GITHUB_TOKEN`) and value
4. Stored encrypted on disk

**Via `.env` file:**
```env
GITHUB_TOKEN=ghp_xxxx
OPENAI_API_KEY=sk-xxxx
APIFY_TOKEN=apify_api_xxxx
```

**Via CLI tools:**
The LLM uses `secrets.get({ key: "GITHUB_TOKEN" })` to retrieve credentials during task execution. It never hardcodes them.

---

## 📊 Agent Studio (Web Dashboard)

A full web-based management console for your agent:

```bash
agent studio
# → Agent Studio running at http://localhost:3333

agent studio --remote
# → Starts a secure tunnel and prints a QR code in terminal for mobile access!
```

### Pages

| Page | What It Shows |
|------|--------------|
| **Console** | Real-time terminal with live command relay |
| **Capabilities** | Loaded tools, permissions, provider info |
| **Goals & Tasks** | Create goals, track progress, view task status |
| **Templates** | Pre-built goal templates (blog writer, data pipeline, etc.) |
| **Credentials** | Encrypted vault — add/delete API keys and tokens |
| **Live Stream** | Real-time WebSocket streaming of task execution output |
| **Skills** | Installed skills with success metrics |
| **Commands** | Lightweight automation templates |
| **Scripts** | Project scripts with execution and output viewer |
| **Plugins** | Installed plugin bundles |
| **Daemon** | Start/stop daemon, view logs, health status |
| **Costs** | LLM token usage, spend tracking by model and day |
| **Memory** | Search and browse persistent agent memory |

### Goal Templates

Studio includes **6 pre-built goal templates** for common workflows:

- 📊 **System Health Monitor** — Dashboard with CPU/memory/disk monitoring
- ✍️ **Blog Post Writer** — Research + write + SEO optimization
- 🕷️ **Apify Actor Creator** — Scaffold a web scraping actor
- 🔍 **Code Review & Refactor** — Analyze and improve code quality
- 🔄 **Data Pipeline** — Fetch → transform → save with error handling
- 📅 **Recurring Report** — Automated daily/weekly reports

---

## 🛠️ Extensibility

### Skills

Reusable AI capabilities defined by a `skill.json` manifest + `prompt.md`:

```bash
agent skills list              # List installed skills
agent skills create my-skill   # Create a custom skill
agent skills stats             # View success metrics
agent skills fix my-skill      # Auto-repair with LLM
```

**Example:** Create `.agent/skills/deploy/skill.json` + `prompt.md` — the agent uses it whenever a deployment goal comes up.

### Commands

Lightweight goal templates — just a markdown file with YAML frontmatter:

```markdown
---
name: deploy-staging
description: Deploy current branch to staging
tools: [cmd.run, git.status]
---
# Deploy to Staging
1. Run `npm test` to verify all tests pass
2. Run `npm run build`
3. Push to staging branch
```

```bash
> /deploy-staging    # Use from interactive mode
```

### Scripts

Direct automation (no LLM needed) — shell, Python, or Node.js:

```yaml
# .agent/scripts/deploy/script.yaml
name: deploy-staging
description: Build and deploy to staging
entrypoint: run.sh
```

```bash
agent scripts run deploy-staging
```

The daemon auto-discovers scripts and can execute them via the `script.run` tool.

### Plugins

Bundle native Node.js tools, skills, commands, scripts, and hooks into a single distributable package. The **Agent Hub** acts as the official registry for community plugins.

```bash
# Install the official GitHub plugin from the Hub
agent plugins install github

# Or install from a local path
agent plugins install ./my-plugin

# List installed plugins
agent plugins list
```

**Featured Plugin: GitHub (`github`)**
- Grants the agent zero-dependency native control over GitHub.
- Can create repos, open PRs, and manipulate Issues.
- Unlocks **Advanced Global Search** natively.
- Can view, dispatch, and monitor **GitHub Actions CI/CD workflows**.

**16 Plugins Available** — Slack, Notion, Vercel, Supabase, Stripe, AWS, Discord, OpenAI, Linear, Docker, MongoDB, Firebase, Telegram, HuggingFace, Resend.

### 🐳 Sandboxed Execution

Run commands safely inside Docker containers:

```bash
agent sandbox start              # Spin up ephemeral container
agent sandbox status             # Container info
agent sandbox stop               # Destroy sandbox
```

### 🐝 Multi-Agent Swarm

Coordinate specialized agents (Planner, Coder, Reviewer, Researcher, Tester):

```bash
agent swarm start "Build a REST API with auth"
agent swarm status               # View agents & tasks
agent swarm roles                # List available roles
```

### 🖥️ Desktop Automation

Cross-platform desktop control (Linux, macOS, Windows):

```bash
agent desktop screenshot         # Capture screen
agent desktop click 500 300      # Mouse click
agent desktop type "Hello" --enter
agent desktop hotkey ctrl+s      # Keyboard shortcut
```

### 🌈 Multimodal Interfaces

Voice, vision, and speech powered by OpenAI:

```bash
agent multimodal transcribe audio.wav      # Whisper STT
agent multimodal analyze image.png         # GPT-4o Vision
agent multimodal speak "Done!"             # TTS
```

### Lifecycle Hooks

Intercept execution at 10 event points:

```json
{
  "hooks": {
    "after:tool": [{
      "match": "fs.write",
      "command": "npx prettier --write {{path}}"
    }]
  }
}
```

---

## 🤖 Interactive Mode

The conversational REPL with multi-turn context:

```bash
agent

> Add rate limiting to the /api/auth endpoint
  ⚡ fs.read(src/routes/auth.ts) ✓
  ⚡ fs.write(src/middleware/rateLimit.ts) ✓
  ✓ Done

> Now write tests for it
  ⚡ fs.write(src/__tests__/rateLimit.test.ts) ✓
  ⚡ cmd.run(npm test) ✓
  ✓ All 5 tests passing

> /deploy-staging
  Running command: deploy-staging...
```

### Slash Commands

| Command | Action |
|---------|--------|
| `/help` | Show all available commands |
| `/skills` | List installed skills |
| `/commands` | List available commands |
| `/scripts` | List available scripts |
| `/model` | Display LLM provider info |
| `/compact` | Summarize and free context |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLI / REPL / Studio                   │
├─────────────────────────────────────────────────────────┤
│                      LLM Router                          │
│   OpenAI │ Anthropic │ Azure │ Ollama (fallback chain)   │
├──────────┬──────────┬──────────┬────────────────────────┤
│  Skills  │ Commands │  Scripts │   Plugins               │
│  prompt  │   .md    │  .yaml   │   bundles               │
├──────────┴──────────┴──────────┴────────────────────────┤
│          Tool Registry & Policy Engine                    │
│  fs.* │ cmd.run │ git.* │ http.* │ secrets.* │ script.*  │
├─────────────────────────────────────────────────────────┤
│  Goal Decomposer │ Daemon │ Credential Vault │ Memory    │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **LLM Router** | Multi-provider routing with fallback chains (OpenAI → Anthropic → Ollama) |
| **Goal Decomposer** | LLM-powered breakdown of goals into dependency-aware task graphs |
| **Daemon Service** | Background task runner with parallel execution, retries, re-planning |
| **Credential Vault** | AES-256-GCM encrypted secret storage with `.env` fallback |
| **Tool Registry** | Sandboxed execution with permission gates |
| **Policy Engine** | Human-in-the-loop approval for sensitive operations |
| **Memory Store** | SQLite + FTS5 persistent memory across sessions |
| **Plugin Loader** | Discovers and loads sub-packages of skills, commands, scripts, hooks |

---

## ⚙️ Configuration

### `agent.yaml` (or `.agent/config.json`)

```yaml
llm:
  provider: openai          # openai | anthropic | azure | ollama
  model: gpt-4o
  fallback:
    - provider: anthropic
      model: claude-3-sonnet

daemon:
  maxConcurrent: 3          # Parallel task limit
  
policy:
  permissions:
    - "*"                   # Wildcard for full autonomy
```

### LLM Providers

| Provider | Env Variable | Models |
|----------|-------------|--------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-3-sonnet, claude-3-opus |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | Any deployed model |
| Ollama | None (local) | llama3, codellama, mistral |

---

## 📋 Full CLI Reference

### Core Commands

```bash
agent                           # Interactive REPL
agent run "<goal>"              # One-shot goal execution
agent init                      # Initialize project
agent studio                    # Web dashboard at :3333
agent doctor                    # System health check
agent update                    # Update to latest version
```

### Goal & Daemon

```bash
agent goal add "<title>"        # Create a goal
agent goal list                 # List all goals
agent goal decompose <id>       # AI breakdown into tasks
agent goal status <id>          # Task-level progress

agent daemon start              # Start background worker
agent daemon stop               # Stop gracefully
agent daemon status             # Health & uptime
agent daemon logs               # Recent execution logs
```

### Skills, Commands, Scripts, Plugins

```bash
agent skills list | create | stats | fix
agent commands list
agent scripts list | run <name> | show <name>
agent plugins list | install <path> | remove <name>
agent hooks list | add <event> <cmd>
```

### Memory & Reports

```bash
agent memory search "<query>"   # Semantic search
agent memory add "<fact>"       # Store a fact
agent report generate           # Activity summary
```

---

## 📁 Project Structure

After `agent init`, your project contains:

```
your-project/
├── .agent/
│   ├── config.json          # Agent configuration
│   ├── vault.json           # Encrypted credentials (auto-created)
│   ├── memory.db            # SQLite persistent memory
│   ├── daemon.log           # Daemon execution log
│   ├── skills/              # Custom skills
│   │   └── my-skill/
│   │       ├── skill.json
│   │       └── prompt.md
│   ├── commands/            # Lightweight commands
│   │   └── deploy.md
│   ├── scripts/             # Automation scripts
│   │   └── health-check/
│   │       ├── script.yaml
│   │       └── run.sh
│   ├── plugins/             # Installed plugins
│   └── hooks/
│       └── hooks.json       # Lifecycle hooks
└── .env                     # Environment variables (auto-detected)
```

---

## 🔒 Security

- **Credential encryption** — AES-256-GCM with machine-specific keys
- **Permission gating** — Policy engine controls which tools can execute
- **Human-in-the-loop** — Tasks can require manual approval before executing
- **No credential leaking** — Secrets are never logged or included in LLM prompts as raw values
- **Sandboxed execution** — Tools execute within the project directory scope

---

## 🆕 What's New in v0.9.27

- **🚀 Remote Studio Access** — `agent studio --remote` generates a secure tunnel URL + QR code for mobile access
- **📡 Live Task Streaming** — Real-time event timeline of daemon task execution (`task:start`/`complete`/`failed`)
- **🔑 Interactive Credential Capture** — When the daemon needs a secret mid-task, a modal pops up in Studio, waiting for you to provide it before continuing
- **🔔 Notifications Plugin** — Auto-notifies on goal completion/failure via Slack, Discord webhook, or SMTP Email
- **💰 Cost Tracker Plugin** — Automatically tracks token usage + cost split by model, with a complete dashboard inside Agent Studio
- **⚡ Parallel Task Execution** — Up to 3 independent tasks run simultaneously
- **🔗 Task Output Chaining** — Downstream tasks receive upstream results
- **🔁 Dynamic Re-decomposition** — Failed tasks trigger LLM re-planning
- **🔑 Credential Vault** — Encrypted secret storage with Studio UI
- **🌐 HTTP Tool** — `http.request` for API integrations
- **📦 Full Capability Loading** — Daemon uses all project skills, scripts, commands, plugins
- **📋 Goal Templates** — 6 pre-built workflow templates in Studio
- **📜 Script & Command Tools** — LLM can execute existing scripts and commands

---

## 🤝 Contributing

We welcome contributions! Key areas:

- Writing new Skills and Commands
- Improving LLM prompt engineering
- Building Studio UI components
- Creating community Plugins
- Writing documentation

---

## License

MIT
