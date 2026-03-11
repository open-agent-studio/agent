# Remote Execution (Agent Cloud)

Run agent goals on a remote machine while streaming live output back to your local terminal.

## Overview

The remote execution feature lets you offload heavy LLM inference to a server (your own cloud VM, a teammate's workstation, or a dedicated Agent Cloud instance) while keeping the familiar CLI experience locally.

Under the hood the system uses **Server-Sent Events (SSE)** so that progress, warnings, tool outputs, and final results stream back in real-time.

## How It Works

```
┌──────────────┐     POST /api/execute      ┌──────────────────┐
│  Local CLI   │ ──────── goal ──────────▶  │  Agent Studio    │
│  (terminal)  │ ◀──── SSE stream ────────  │  (remote server) │
└──────────────┘                            └──────────────────┘
```

1. The local CLI sends a `POST` request with the `goal` to the remote server's `/api/execute` endpoint.
2. The server runs the full agent loop (LLM routing, tool execution, skill running) on its side.
3. Progress events stream back as SSE (`event: progress`, `event: success`, `event: error`, `event: done`).
4. The local CLI renders each event in the terminal exactly as if the agent were running locally.

## Usage

### 1. Start the Studio server on the remote machine

```bash
# On the remote server / cloud VM
agent studio --port 3333
```

### 2. Run a goal with `--remote`

```bash
# On your local machine
agent run "Summarize the README" --remote http://<remote-ip>:3333
```

The output streams live to your terminal:

```
▶ Connecting to remote agent: http://remote:3333
────────────────────────────────────────────────────────────
  1/1 Sending goal to daemon...
  ℹ Reading README.md ...
  ℹ Generating summary ...
  ✓ Remote goal completed

Result:
  The README describes an autonomous AI agent runtime ...
```

## API Reference

### `POST /api/execute`

| Field | Type | Description |
|-------|------|-------------|
| `goal` | `string` | **Required.** The goal for the agent to execute. |

**Response**: `text/event-stream` (SSE)

#### SSE Event Types

| Event | Data Fields | Description |
|-------|-------------|-------------|
| `progress` | `{ message }` | Intermediate progress update |
| `success` | `{ message }` | A tool or step completed successfully |
| `warning` | `{ message }` | Non-fatal warning |
| `error` | `{ message }` | Fatal error — execution stops |
| `done` | `{ result }` | Final result — goal completed |

### Example with `curl`

```bash
curl -N -X POST http://localhost:3333/api/execute \
  -H "Content-Type: application/json" \
  -d '{"goal": "List all files in the project"}'
```

## Security Considerations

- The `/api/execute` endpoint currently has **no authentication**.  In production, you should place it behind a reverse proxy with TLS and API key authentication.
- Use `agent studio --remote` to enable tunnel access with a token for remote connections.
- Never expose the Studio port directly to the public internet without authentication.

## Requirements

- The remote machine must have the Agent Runtime installed and configured with LLM API keys.
- Both machines need network connectivity (or use the built-in tunnel feature).
