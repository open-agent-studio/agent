# Changelog

All notable changes to the Agent Runtime repository will be documented in this file.

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
