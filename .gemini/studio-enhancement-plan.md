# Agent Studio Enhancement + Documentation Plan

## Overview
Two parallel workstreams:
1. **Studio Enhancement** — Full management UI for all agent subsystems
2. **Documentation** — Comprehensive docs covering the entire runtime

---

## 1. Studio Enhancement Plan

### Current State
- Dashboard: Shows active instances (REPL + daemon)
- Per-instance sidebar: Console, Capabilities, Goals (placeholder), Memory (placeholder)
- Backend APIs: `/api/instances`, `/api/instances/:id/capabilities`, `/api/instances/:id/goals`, `/api/instances/:id/memory`
- WebSocket: Live log streaming + approval relay

### New Pages & Components Needed

#### A. Goals & Plans Management
- **GoalsPanel.tsx** — List goals, create new goals, view status, decompose via API
- **PlanViewer.tsx** — View and run execution plans
- Backend APIs:
  - `POST /api/instances/:id/goals` — Create goal
  - `POST /api/instances/:id/goals/:goalId/decompose` — AI decompose
  - `GET /api/instances/:id/plans` — List plans
  - `POST /api/instances/:id/plans` — Propose plan
  - `POST /api/instances/:id/plans/:planId/run` — Execute plan

#### B. Daemon Management
- **DaemonPanel.tsx** — Start/stop/status of background daemon
- Backend APIs:
  - `POST /api/instances/:id/daemon/start`
  - `POST /api/instances/:id/daemon/stop`
  - `GET /api/instances/:id/daemon/status`
  - `GET /api/instances/:id/daemon/logs`

#### C. Skills Management
- **SkillsManager.tsx** — List, create, edit, delete skills
- Inline YAML/Markdown editor for `skill.json` + `prompt.md`
- Backend APIs:
  - `GET /api/instances/:id/skills` — List all skills
  - `POST /api/instances/:id/skills` — Create skill
  - `PUT /api/instances/:id/skills/:name` — Update skill
  - `DELETE /api/instances/:id/skills/:name` — Delete skill

#### D. Commands Manager
- **CommandsManager.tsx** — CRUD for lightweight commands
- Backend:
  - `GET/POST/PUT/DELETE /api/instances/:id/commands`

#### E. Scripts Manager
- **ScriptsManager.tsx** — CRUD for local scripts
- Backend:
  - `GET/POST/PUT/DELETE /api/instances/:id/scripts`

#### F. Plugins Manager
- **PluginsManager.tsx** — Install/remove/list plugins
- Backend:
  - `GET /api/instances/:id/plugins`
  - `POST /api/instances/:id/plugins/install`
  - `DELETE /api/instances/:id/plugins/:name`

#### G. Memory Explorer
- **MemoryExplorer.tsx** — Search, add, view memories
- Backend already exists, add:
  - `POST /api/instances/:id/memory` — Add memory
  - `GET /api/instances/:id/memory/search?q=...`

#### H. Updated Sidebar Navigation
Add nav items: Console, Capabilities, Goals & Plans, Daemon, Skills, Commands, Scripts, Plugins, Memory

### Execution Order
1. Backend API routes (server/app.ts)
2. Sidebar navigation update (App.tsx)
3. Individual panels (one at a time)

---

## 2. Documentation Plan

### Current Docs
- README.md (comprehensive but needs Studio section + version update)
- 8 learning series articles in docs/articles/
- 1 comparison doc

### New Documentation Needed
1. **docs/README.md** — Documentation index/hub
2. **docs/articles/09-agent-studio.md** — Studio UI guide
3. **docs/articles/10-llm-providers.md** — Provider configuration
4. **docs/articles/11-policy-approvals.md** — Permission & approval system
5. **docs/articles/12-daemon-automation.md** — Background daemon deep-dive
6. **docs/API.md** — Full REST API reference for Studio
7. **docs/CONFIGURATION.md** — Complete config reference
8. Update README.md with Studio section + v0.9.8

---

## Execution Priority
1. Backend APIs (the foundation)
2. Sidebar + navigation
3. Goals & Plans panel (most requested)
4. Skills Manager
5. Memory Explorer
6. Daemon panel
7. Commands + Scripts + Plugins managers
8. Documentation (in parallel where possible)
