# Changelog

All notable changes to the Agent Runtime repository will be documented in this file.

## [0.12.3] - "GUI Operator Hotfix"
### Fixed
- Stabilized `agent run --role operator` CLI invocation. Operator personas now dynamically load system configuration and natively bypass local runtime `tools.enabled` sandbox restrictions to properly fetch the OS Desktop Tree without throwing false configuration blockades.
- Re-architected LLM Router tool sanitization logic to support hardcoded underscore parameters (like Anthropic's `computer_20241022`).

## [0.12.2] - "Studio Multi-Model Integration"
### Added
- **Studio Multi-Model Dashboard**: Dynamically switch the daemon's underlying LLM brain (OpenAI, Anthropic, Google Gemini, Groq, Ollama) directly from the Web UI.
- Secure visual vault integration allowing API Key storage immediately into `.agent/vault.json`.
- Advanced Model Cost Tracking metrics and sub-routers updated in `src/llm/router.ts`.

## [0.12.1] - "GUI Operator"
### Added
- **GUI Operator Swarm Persona**: Introduced the advanced `operator` role natively inside the Swarm stack. The operator uses `desktop.ui_tree` and `computer_20241022` entirely by itself to perform continuous UI interactions deterministically across the active operating system without requesting coding help.

## [0.12.0] - "Advanced Desktop Vision"
### Added
- **Phase 12: Advanced Desktop Automation** features.
- Introduced `desktop.ui_tree` tool which utilizes `os-native` APIs to dump the actual desktop window UI hierarchy on macOS, Windows, and Linux. This provides an exact "Desktop DOM" equivalent of HTML for deterministic local agents.
- Integrated the native Anthropic `computer_20241022` tool schema in `src/tools/core/computer.ts` to seamlessly power the new "Computer Use" LLM models.

### Fixed
- Stabilized Linux AT-SPI script imports checking `STATE_VISIBLE`.
- Secured macOS JXA accessibility commands to write securely to temporary script files.

## [0.11.1] - "Agent Cloud Phase"
### Added
- **API Authentication** using JWT keys allowing `/api/execute` endpoint lockdown. 
- **Persistent Sessions** with `memory.db` to let the agent preserve conversations and state continuously.
- **MCP Server HTTP Mode** with `agent mcp serve --http` allowing usage inside Cursor!
- **Multi-Agent Swarm** allowing cross-machine communication via internal `RemoteAgentBridge`.
- **Plugin Marketplace UI** integrated into Agent Studio web endpoints and terminal `agent plugins install`. 
