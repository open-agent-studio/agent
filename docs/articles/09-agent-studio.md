# Agent Studio — Visual Management Console

> The web-based command center for your Agent Runtime instances.

Agent Studio is the visual companion to the CLI. It provides a unified dashboard where
you can monitor live instances, manage goals, create skills and commands, control the
daemon, and explore agent memory — all from your browser.

---

## 🚀 Launching Studio

```bash
agent studio
# → Agent Studio running at http://localhost:3333
```

The command starts an Express server that serves both the REST API and the React frontend.

---

## Dashboard

The landing page shows all active Agent instances — both interactive REPL sessions and
background daemon processes.

Each instance card displays:
- **Project name** and working directory  
- **PID** for process identification  
- **Status badge** (Active / Daemon)  
- Quick navigation buttons for Console and Capabilities

![Agent Studio Dashboard](studio-screenshot-1.png)

---

## Instance Control Panel

Click any instance to enter the **control panel** with a sidebar of 9 sections:

| Section | Purpose |
|---------|---------|
| **Console** | Live terminal — send commands, see agent output in real-time |
| **Capabilities** | Read-only view of loaded skills, commands, scripts, plugins |
| **Goals & Plans** | Create goals, view tasks, update statuses |
| **Skills** | CRUD manager for skill definitions (skill.json + prompt.md) |
| **Commands** | Create/delete lightweight command templates |
| **Scripts** | Create/delete local automation scripts |
| **Plugins** | View and remove installed plugin bundles |
| **Daemon** | Start/stop the background worker, view daemon logs |
| **Memory** | Search, add, and browse persistent agent memories |

![Agent Console View](studio-screenshot-agent-console-2.png)

---

## Goals & Plans

The Goals panel lets you:

1. **Create goals** with title, description, and priority
2. **View task breakdown** — expand a goal to see its decomposed tasks
3. **Update status** — pause, resume, or complete goals
4. **Delete goals** and their associated tasks

Each task shows its execution status (pending → running → completed/failed) and
the assigned skill.

---

## Skills Manager

Skills are reusable AI capabilities defined by `skill.json` + `prompt.md`.

From the Studio you can:
- **Create** a new skill with name, description, tools, and prompt content
- **Edit** the prompt markdown inline with a code editor
- **Delete** skills you no longer need

Changes are written directly to `.agent/skills/` on disk.

---

## Commands Manager

Commands are lightweight goal templates — just markdown files with YAML frontmatter.

- **Create** commands with name, description, allowed tools, and body
- **Delete** commands
- Commands appear as `/slash-commands` in the interactive REPL

---

## Scripts Manager

Scripts are deterministic automation tasks (shell, TypeScript, Python) with a
`script.yaml` manifest.

- **Create** scripts by choosing a language and writing the entrypoint
- **Delete** scripts
- Scripts execute without LLM involvement — perfect for CI/CD

---

## Daemon Control

The daemon is the background worker that processes goals autonomously.

- **Start/Stop** the daemon with one click
- **Live status** — see PID, uptime, and running state
- **Log viewer** — color-coded logs with auto-refresh

---

## Memory Explorer

Agent memory is a SQLite-backed persistent store with full-text search.

- **Search** across all memories using FTS5
- **Add** new memories with category and tags
- **Browse** memories grouped by category (project, fact, preference, learned, general)
- **Delete** individual memories
- **Stats** — see totals broken down by category

---

## REST API

Studio exposes a comprehensive REST API. See [API Reference](../API.md) for full details.

Key endpoints:
- `GET /api/instances` — list active instances
- `POST /api/instances/:id/goals` — create a goal
- `GET /api/instances/:id/skills` — list skills
- `POST /api/instances/:id/memory` — add a memory
- `POST /api/instances/:id/daemon/start` — start the daemon

---

## Architecture

```
Browser (React + Vite)
      ↕ HTTP/WebSocket
Studio Server (Express + Socket.IO)
      ↕
Agent Runtime (GoalStore, SkillLoader, MemoryStore, DaemonManager)
      ↕
File System (.agent/) + SQLite (agent.db)
```

The Studio server reuses the same classes as the CLI — `GoalStore`, `SkillLoader`,
`CommandLoader`, `ScriptLoader`, `MemoryStore`, `DaemonManager` — so all operations
are consistent between CLI and UI.
