# 🛣️ Roadmap: The Future of @praveencs/agent

We have built a robust autonomous agent runtime (`v0.9.x`). Here is our progress on the major milestones.

## Phase 1: Robustness & Safety ✅
- [x] **Sandboxed Execution**: Run all shell commands inside ephemeral Docker containers via `src/sandbox/`. Configure image, network, and mounts in `agent.yaml`.
- [x] **Permission Scopes**: Fine-grained access control via the policy engine (`config.policy`).
- [x] **Secrets Management**: Encrypted credential vault with `agent studio` Credentials page and `secrets.get/set/list` tools.

## Phase 2: Multi-Agent Collaboration (The Swarm) ✅
- [x] **Agent-to-Agent Protocol**: Event-driven `MessageBus` for inter-agent communication with pub/sub, broadcast, and history.
- [x] **Specialized Personas**: 5 built-in roles — Planner, Coder, Reviewer, Researcher, Tester — each with system prompts and tool permissions.
- [x] **Orchestrator**: `SwarmOrchestrator` spawns agents, assigns tasks, handles delegation chains up to configurable depth.

## Phase 3: Multimodal Interfaces ✅
- [x] **Voice Interface**: Speech-to-text via OpenAI Whisper (`agent multimodal transcribe`).
- [x] **Vision Capabilities**: Image analysis via GPT-4o vision (`agent multimodal analyze`) — supports local files and URLs.
- [x] **Text-to-Speech**: Generate spoken audio with 6 voices (`agent multimodal speak`).
- [ ] **IDE Integration**: VS Code extension to have the agent live in your editor sidebar.

## Phase 4: The Agent Cloud
- [x] **Skill Hub**: Agent Hub with 16 plugins (registry + remote install from GitHub).
- [ ] **Remote Execution**: Run the heavy agent logic on a cloud server while controlling it from your laptop.
- [x] **Web Dashboard**: Agent Studio with real-time visualization, 18 panels, and REST API.

## Phase 5: Plugin Ecosystem & Extensibility ✅
- [x] **Lifecycle Hooks**: Event-driven hook system (`before:tool`, `after:step`, `before:plan`, etc.).
- [x] **Lightweight Commands**: Reusable goal templates as markdown files with YAML frontmatter.
- [x] **Multi-CLI Orchestration**: Tool wrappers for external AI CLIs (`cli.cursor`, `cli.codex`, `cli.gemini`, `cli.claude`).
- [x] **Plugin System**: 16 distributable plugins (GitHub, Slack, Notion, Vercel, Supabase, Stripe, AWS, Discord, OpenAI, Linear, Docker, MongoDB, Firebase, Telegram, HuggingFace, Resend).
- [x] **Scripts System**: Repeatable scriptable tasks via `script.yaml`.
- [x] **New CLI Commands**: `agent hooks|commands|plugins|scripts|sandbox|swarm|desktop|multimodal`.

## Phase 6: Interactive CLI Experience ✅
- [x] **Interactive REPL**: Conversational sessions with multi-turn context and slash commands.
- [x] **Slash Commands**: Built-in `/help`, `/skills`, `/commands`, `/hooks`, `/model`, `/compact`, `/clear`, `/exit`.
- [x] **Rich Terminal UI**: Bordered welcome banner, spinners, inline tool call badges, completion timing.
- [x] **Tab Completion**: Autocomplete slash commands in the REPL.
- [x] **Conversation Context**: Multi-turn with conversation compaction support.

## Phase 7: Desktop Automation (All OS) ✅
- [x] **`desktop.screenshot`**: Cross-platform capture (scrot/gnome-screenshot, screencapture, PowerShell).
- [x] **`desktop.click`** / **`desktop.doubleClick`** / **`desktop.rightClick`**: Mouse control via xdotool/osascript.
- [x] **`desktop.type`** / **`desktop.hotkey`**: Keyboard input and shortcut combinations.
- [x] **`desktop.scroll`**: Scroll at position.
- [x] **`desktop.drag`**: Drag from point A to point B.
- [x] **Cross-platform engine**: Works on Linux (xdotool), macOS (osascript/cliclick), and Windows (PowerShell).

### Layer 2: AI-Powered Vision ✅
- [x] **Vision Loop**: Screenshot → GPT-4o analysis → action → verify cycle via MultimodalEngine.
- [ ] **Element Detection**: Use image template matching for UI element recognition.
- [ ] **OCR Integration**: Extract text from screen regions.

### Layer 3: OS-Native Accessibility APIs (Partial)
- [x] **macOS**: AppleScript/osascript for native app control.
- [x] **Linux**: xdotool for X11 window management.
- [ ] **Windows**: PowerShell + UI Automation API.

### Layer 4: Browser Automation
- [ ] **Playwright Integration**: `desktop.browser.open`, `desktop.browser.click`, `desktop.browser.fill`.
- [ ] **Cookie/Session Persistence**: Maintain browser sessions across agent runs.

### Use Cases
- *"Open Figma, export the homepage design as PNG, then create a Next.js component from it"*
- *"Fill out this expense report in the company portal"*
- *"Take a screenshot of the staging site and compare it to the design mockup"*
- *"Open Slack and send the deployment status to #engineering"*

## 🤝 Join the Mission
This is an open-source journey. We need help with:
- Writing new Skills (see `docs/articles/03-skill-execution.md`)
- Improving the Planner prompt engineering
- Building the Web Dashboard
- Building Desktop Automation plugins

Submit a PR and let's build the future of work, together.
