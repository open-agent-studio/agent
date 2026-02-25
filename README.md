# 🤖 Agent Runtime

> An autonomous, goal-oriented AI agent runtime with an interactive CLI, plugin ecosystem, and self-improvement capabilities.

[![npm version](https://img.shields.io/npm/v/@praveencs/agent)](https://www.npmjs.com/package/@praveencs/agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```
$ agent

  ╭────────────────────────────────────────────────╮
  │  🤖 Agent Runtime v0.8.1                       │
  │    Project: my-app                              │
  │    Model: gpt-4o │ 3 skills │ 2 commands        │
  ╰────────────────────────────────────────────────╯

  Type a goal, a /command, or /help for help.

  > Refactor the auth module to use JWT
  ⠋ Thinking...
  ⚡ fs.read(src/auth/handler.ts) ✓
  ⚡ fs.write(src/auth/jwt.ts) ✓
  ⚡ cmd.run(npm test) ✓

  ✓ Done (12.3s)

  > /deploy-staging
  Running command: deploy-staging...
```

---

## ✨ Features

| Category | Capabilities |
|----------|-------------|
| **🤖 Interactive CLI** | Conversational REPL with multi-turn context, slash commands, and tab completion |
| **🧠 Goal Decomposition** | LLM-powered breakdown of complex objectives into dependency-aware task graphs |
| **⚡ Autonomous Execution** | Background daemon processes tasks with retries, rollback, and verification |
| **🛠️ Extensible Skills** | Markdown-based skill definitions—install from a hub or write your own |
| **⚡ Lightweight Commands** | Quick goal templates as markdown files—no boilerplate needed |
| **📜 Scripts System** | Repeatable local tasks defined in `script.yaml` for direct execution |
| **🪝 Lifecycle Hooks** | Intercept execution at 10 event points (before:tool, after:plan, etc.) |
| **🔌 Plugin System** | Bundle skills, commands, scripts, and hooks into distributable packages |
| **🔧 Multi-CLI Orchestration** | Delegate tasks to Cursor, Codex, Gemini, or Claude CLIs |
| **💾 Persistent Memory** | SQLite + FTS5 semantic memory across sessions |
| **❤️ Self-Improvement** | Monitors skill metrics and auto-patches failing skills |
| **📊 Reporting** | Daily standup reports and AI-generated executive summaries |
| **🔒 Policy Engine** | Permission-gated tool execution with human-in-the-loop approval |

---

## 📦 Installation

```bash
npm install -g @praveencs/agent
```

### Quick Start

```bash
# Initialize project configuration
agent init

# Launch interactive mode (recommended)
agent

# Or run a one-off goal
agent run "Add input validation to the signup form"
```

### Configuration

After `agent init`, a `.agent/` directory is created in your project with configuration, skills, commands, and hooks. Set your LLM provider API keys:

```bash
# Set via environment variables
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...

# Or configure directly
agent config --init
```

---

## 📖 Usage Guide

### 1. Interactive Mode (Recommended)

Type `agent` with no arguments to enter the **Interactive REPL**:

```bash
agent
```

You get a bordered welcome banner showing your project, model, and loaded extensions. Then just type naturally:

```
  > Add rate limiting to the /api/auth endpoint
  > Now write tests for it
  > /deploy-staging
```

The agent **remembers context** across turns—no need to repeat yourself.

#### Slash Commands

| Command | Action |
|---------|--------|
| `/help` | Show all available commands |
| `/skills` | List installed skills with status |
| `/commands` | List available lightweight commands |
| `/scripts` | List available local scripts |
| `/hooks` | Show registered lifecycle hooks |
| `/model` | Display current model and provider info |
| `/compact` | Summarize conversation and free context |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit interactive mode |

Custom commands from `.agent/commands/` are also available as slash commands (e.g., `/deploy-staging`).

**Tab completion** works on all slash commands—press `Tab` after `/`.

---

### 2. One-Shot Mode

Run a single goal without entering the REPL:

```bash
agent run "Refactor the database module to use connection pooling"
agent run "Fix all TypeScript errors in the project"
agent run deploy-staging          # Runs a named Command or Skill
```

---

### 3. Skills

Skills are reusable capabilities defined by markdown prompts and a `skill.json` manifest.

```bash
# List installed skills
agent skills list

# Search the skill hub
agent skills search "docker"

# Install a skill
agent skills install <skill-name>

# Create a custom skill
agent skills create my-new-skill
# → Creates .agent/skills/my-new-skill/prompt.md

# Self-healing
agent skills stats               # View success rates
agent skills doctor my-skill     # Diagnose failures
agent skills fix my-skill        # Auto-repair with LLM
```

---

### 4. Lightweight Commands

Commands are quick goal templates—just a markdown file. No `skill.json` needed.

Create `.agent/commands/deploy-staging.md`:

```markdown
---
name: deploy-staging
description: Deploy current branch to staging
tools: [cmd.run, git.status, git.diff]
---
# Deploy to Staging

Steps:
1. Run `npm test` to verify all tests pass
2. Run `npm run build` to create the production bundle
3. Run `git push origin HEAD:staging` to trigger deployment
```

Now use it:

```bash
agent run deploy-staging     # From CLI
# or
> /deploy-staging            # From interactive mode
```

The command's markdown body becomes the LLM prompt, and only the whitelisted tools are available.

```bash
agent commands list          # See all available commands
```

---

### 5. Scripts

Scripts are repeatable, scriptable tasks (shell/Node Python) defined via a `script.yaml` manifest. They differ from Skills and Commands because they execute directly without LLM involvement, making them perfect for CI/CD tasks, builds, or deployments.

Create `.agent/scripts/deploy/script.yaml`:

```yaml
name: deploy-staging
description: Build and deploy current branch to staging
entrypoint: deploy.sh
confirm: true
args:
  branch:
    description: Branch to deploy
    default: main
```

Create exactly the script you need (`deploy.sh` or `deploy.ts`):

```bash
#!/bin/bash
echo "Deploying branch ${SCRIPT_ARG_BRANCH:-main}..."
npm run build && git push origin HEAD:staging
```

Now execute it directly from the CLI or REPL:

```bash
agent scripts run deploy-staging --branch develop
# or interactively
> /scripts
> agent scripts run deploy-staging
```

Scripts are automatically provided as context to the LLM, so if you ask the agent to "deploy to staging", it knows it can use your exact shell script to do it.

---

### 6. Lifecycle Hooks

Hooks intercept agent execution at every point. Define them in `.agent/hooks/hooks.json`:

```json
{
  "hooks": {
    "after:tool": [
      {
        "match": "fs.write",
        "command": "npx prettier --write {{path}}",
        "blocking": false
      }
    ],
    "before:plan": [
      {
        "command": "./scripts/validate-env.sh",
        "blocking": true
      }
    ]
  }
}
```

#### Available Events

| Event | When |
|-------|------|
| `before:tool` / `after:tool` | Before/after any tool executes |
| `before:plan` / `after:plan` | Before/after a plan runs |
| `after:step` | After each plan step |
| `before:skill` / `after:skill` | Around skill execution |
| `after:decompose` | After goal decomposition |
| `session:start` / `session:end` | At session boundaries |

```bash
agent hooks list             # Show registered hooks
agent hooks add after:tool "npx eslint --fix {{path}}" --match fs.write
agent hooks events           # Show all available events
```

---

### 6. Plugins

Bundle skills, commands, and hooks into a distributable package:

```
my-plugin/
├── plugin.json
├── skills/
│   └── security-scan/
│       ├── skill.json
│       └── prompt.md
├── commands/
│   └── audit.md
└── hooks/
    └── hooks.json
```

`plugin.json`:
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

```bash
agent plugins install ./my-plugin    # Install from local path
agent plugins list                   # Show installed plugins
agent plugins remove my-plugin       # Uninstall
```

---

### 7. Multi-CLI Orchestration

The agent can delegate tasks to external AI CLIs when they're the right tool for the job:

| Tool | CLI | Best For |
|------|-----|----------|
| `cli.cursor` | Cursor | Multi-file refactoring with codebase context |
| `cli.codex` | OpenAI Codex | Code generation with sandbox execution |
| `cli.gemini` | Gemini | Large-context analysis and reasoning |
| `cli.claude` | Claude | Careful code review and generation |

Configure in `.agent/config.json`:
```json
{
  "cliTools": {
    "cursor": { "binary": "cursor", "available": true },
    "claude": { "binary": "claude", "available": true }
  }
}
```

The LLM orchestrator automatically selects the right CLI based on the task.

---

### 8. Goal Management & Daemon

For long-running, multi-step projects:

```bash
# Create a goal
agent goal add "Build authentication with OAuth2" --priority 1

# AI decomposes into tasks
agent goal decompose 1

# Run tasks autonomously
agent daemon start

# Monitor progress
agent goal list               # See goal status
agent goal status 1           # Detailed task view
agent daemon status           # Daemon health
agent daemon logs             # Recent execution logs

# Get reports
agent report generate --summary
```

---

### 9. Plans

Create and run structured execution plans:

```bash
agent plan propose "Migrate database from MySQL to PostgreSQL"
agent plan list
agent plan run <plan-file>
```

---

### 10. Memory

The agent stores facts, learnings, and project context persistently:

```bash
agent memory search "database credentials"
agent memory add "Staging server is at 10.0.0.5" --category fact
```

---

## 🤖 Full CLI Reference

### Core

| Command | Description |
|---------|-------------|
| `agent` | Launch interactive REPL (no subcommand) |
| `agent run "<goal>"` | One-shot goal execution |
| `agent init` | Initialize project configuration |
| `agent config --init` | Set up global config |
| `agent doctor` | System health check |

### Skills

| Command | Description |
|---------|-------------|
| `agent skills list` | List installed skills |
| `agent skills search <query>` | Search the skill hub |
| `agent skills install <name>` | Install a skill |
| `agent skills create <name>` | Create a custom skill |
| `agent skills stats` | View performance metrics |
| `agent skills doctor <name>` | Diagnose a failing skill |
| `agent skills fix <name>` | Auto-repair with LLM |

### Commands

| Command | Description |
|---------|-------------|
| `agent commands list` | List available commands |

### Scripts

| Command | Description |
|---------|-------------|
| `agent scripts list` | List available scripts |
| `agent scripts run <name>` | Execute a script directly |
| `agent scripts show <name>` | Show script arguments and details |

### Hooks

| Command | Description |
|---------|-------------|
| `agent hooks list` | Show registered hooks |
| `agent hooks add <event> <cmd>` | Add a new hook |
| `agent hooks events` | Show all hook events |

### Plugins

| Command | Description |
|---------|-------------|
| `agent plugins list` | List installed plugins |
| `agent plugins install <path>` | Install from local path |
| `agent plugins remove <name>` | Remove a plugin |

### Goals & Daemon

| Command | Description |
|---------|-------------|
| `agent goal add "<title>"` | Create a goal |
| `agent goal list` | List goals |
| `agent goal decompose <id>` | AI breakdown |
| `agent goal status <id>` | Task-level progress |
| `agent daemon start` | Start background worker |
| `agent daemon stop` | Stop background worker |
| `agent daemon status` | Health & uptime |

### Plans, Memory & Reports

| Command | Description |
|---------|-------------|
| `agent plan propose "<desc>"` | AI-generate a plan |
| `agent plan run <file>` | Execute a plan |
| `agent memory search <query>` | Search agent memory |
| `agent memory add "<fact>"` | Store a fact |
| `agent report generate` | Activity report |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLI / REPL                        │
│  agent run │ agent (REPL) │ /slash-commands │ MCP   │
├─────────────────────────────────────────────────────┤
│                  LLM Router                          │
│  OpenAI │ Anthropic │ Azure │ Ollama (fallback)     │
├──────────┬──────────┬──────────┬────────────────────┤
│  Skills  │ Commands │  Hooks   │    Plugins          │
│  .md     │  .md     │  .json   │    bundles          │
├──────────┴──────────┴──────────┴────────────────────┤
│              Tool Registry & Policy Engine           │
│  fs.* │ cmd.run │ git.* │ cli.* │ project.detect    │
├─────────────────────────────────────────────────────┤
│  Planner  │ Executor │ Memory  │ Daemon │ Reporter  │
└─────────────────────────────────────────────────────┘
```

**Key Components:**
- **CLI / REPL**: Entry point—interactive or subcommand-based
- **LLM Router**: Multi-provider with offline-first support and fallback chains
- **Skills**: Markdown prompt-based capabilities
- **Commands**: Lightweight goal templates (YAML frontmatter + prompt)
- **Scripts**: Direct executable automation with argument injection
- **Hooks**: Event-driven lifecycle interception
- **Plugins**: Distributable bundles of skills + commands + scripts + hooks
- **Tool Registry**: Sandboxed tool execution with permission gates
- **Policy Engine**: Human-in-the-loop approval for sensitive operations
- **Multi-CLI Tools**: Cursor, Codex, Gemini, Claude wrappers

---

## 📚 Learning Series

Understand the agent architecture with our 7-part deep-dive:

1. [**Vision & Architecture**](docs/articles/01-vision-architecture.md) — The high-level design
2. [**The Brain (Planner)**](docs/articles/02-goal-decomposition.md) — Goal decomposition
3. [**The Body (Executor)**](docs/articles/03-skill-execution.md) — Secure skill execution
4. [**Memory & Context**](docs/articles/04-memory-persistence.md) — SQLite & semantic search
5. [**Self-Improvement**](docs/articles/05-self-improvement.md) — Metrics & the Auto-Fixer
6. [**Plugin Ecosystem**](docs/articles/06-plugin-ecosystem.md) — Hooks, commands, multi-CLI
7. [**Interactive CLI**](docs/articles/07-interactive-cli.md) — The conversational experience
8. [**Scripts System**](docs/articles/08-scripts-system.md) — Non-LLM deterministic automation

### Comparisons
- [**vs OpenClaw**](docs/comparisons/openclaw.md) — How we differ from AI OS projects

---

## 🔮 Roadmap

Check out our detailed [**ROADMAP.md**](ROADMAP.md) to see what's next:
- ✅ **Phase 5**: Plugin Ecosystem & Extensibility
- ✅ **Phase 6**: Interactive CLI Experience
- 🔜 **Phase 1**: Sandboxed Execution & Secrets Management
- 🔜 **Phase 2**: Multi-Agent Collaboration (The Swarm)
- 🔜 **Phase 3**: Voice & Vision Interfaces
- 🔜 **Phase 4**: The Agent Cloud (Skill Hub, Remote Execution, Dashboard)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

Key areas where we need help:
- Writing new Skills
- Improving Planner prompt engineering
- Building the Web Dashboard
- Creating community Plugins

---

## License

MIT
