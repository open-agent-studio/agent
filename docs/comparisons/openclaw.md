# Comparison: @open-agent-studio/agent vs OpenClaw

This document compares `@open-agent-studio/agent` v0.8.0 (this project) with [OpenClaw](https://github.com/openclaw/openclaw), a popular open-source AI operating system.

## 1. Core Philosophy

| Feature | @open-agent-studio/agent | OpenClaw |
|---|---|---|
| **Primary Goal** | **Autonomous Task Execution.** Designed to be a headless "digital employee" that plans and builds software in the background. | **AI Operating System.** Designed to be a "24/7 Jarvis" that integrates with chat apps (Discord, Telegram) and manages your digital life. |
| **Interaction** | **CLI-First + Interactive REPL.** Subcommands for automation, plus a conversational mode with slash commands. | **Chat-First.** You talk to it via various messaging platforms. |
| **Persona** | A Junior Developer / Project Manager. | A Personal Assistant / OS Interface. |

## 2. Architecture

### @open-agent-studio/agent
- **Monolithic CLI/Daemon**: A single TypeScript application that runs locally.
- **Interactive REPL**: Conversational mode with multi-turn context (v0.8.0).
- **Daemon Loop**: A background process that polls a queue of tasks.
- **Planner-Executor Split**: Explicit "Brain" (Goal Decomposition) and "Body" (Task Execution) separation.
- **Plugin System**: Extensible via hooks, commands, and plugin bundles (v0.8.0).
- **Database**: Uses `better-sqlite3` for high-performance, structured local storage.

### OpenClaw
- **Gateway Architecture**: A Hub-and-Spoke model with a central Gateway managing WebSocket connections to various "Channels" (Telegram, Discord).
- **Service Mesh**: Decouples the "Brain" from the inputs/outputs via adapters.
- **Markdown-First Memory**: Stores state and memory as flat Markdown files on disk.

## 3. Capabilities & Skills

| | @open-agent-studio/agent | OpenClaw |
|---|---|---|
| **Skill Definition** | **Prompt-as-Code.** Skills are `.md` files + Commands are lightweight goal templates. | **Plugin System.** Code-based plugins to extend functionality. |
| **Execution** | **Shell-Native + Multi-CLI.** Executes command-line tools natively AND delegates to Cursor/Codex/Gemini/Claude CLIs. | **Sandbox-Native.** Heavily focuses on browser automation and secure sandboxing. |
| **Extensibility** | **Hooks + Plugins.** Lifecycle hooks at every execution point, distributable plugin bundles. | **Plugin-based.** Extends via code plugins. |
| **Self-Improvement** | **Built-in Auto-Fixer.** Monitors success rates and rewrites broken skills automatically. | **Manual/Plugin.** Relies on users or plugin updates. |

## 4. CLI Experience

| | @open-agent-studio/agent v0.8.0 | OpenClaw |
|---|---|---|
| **Interactive Mode** | ✅ Conversational REPL with multi-turn context | ❌ Chat-app dependent |
| **Slash Commands** | ✅ `/help`, `/skills`, `/commands`, `/hooks`, `/model`, custom user commands | N/A |
| **Tab Completion** | ✅ Built-in autocomplete | N/A |
| **Lifecycle Hooks** | ✅ 10 event types with template variables | ❌ |
| **Multi-CLI Orchestration** | ✅ Cursor, Codex, Gemini, Claude wrappers | ❌ |

## 5. Memory Implementation

### @open-agent-studio/agent
- **Hybrid Storage**: Uses **SQLite** for structured data (tasks, metrics) and **Vector/FTS5** layers for semantic search.
- **Why?**: Faster retrieval for large codebases and project histories. Allows complex queries ("Select tasks from 2 days ago related to 'database'").

### OpenClaw
- **File-System Storage**: Stores conversations and memories as Markdown files.
- **Why?**: "Unix philosophy" - easy to read/edit by humans, no database dependencies.

## 6. Use Case Recommendation

**Choose @open-agent-studio/agent if:**
- You want an AI to **write code, manage servers, or automate dev workflows**.
- You want an **interactive conversational CLI** experience.
- You need a **plugin ecosystem** to extend capabilities.
- You want to **orchestrate multiple AI CLIs** (Cursor, Claude, etc.).
- You need structured planning and long-term project management.
- You want a system that improves itself over time.

**Choose OpenClaw if:**
- You want to **chat with your AI** via WhatsApp/Discord.
- You need a personal assistant to manage emails, calendars, and smart home devices.
- You prefer storing data in plain text files.
- You want deep browser automation capabilities.

## Summary

While OpenClaw builds a bridge between AI and *Communication Channels*, `@open-agent-studio/agent` builds a bridge between AI and *Work Execution*. With v0.8.0, we've added extensibility (plugins, hooks, commands) and a modern interactive CLI, making it the most developer-centric autonomous agent available.
