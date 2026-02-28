# Daemon & Background Automation

> Autonomous goal execution with scheduling, triggers, and monitoring.

---

## Overview

The **Daemon** is a background worker that processes goals and tasks autonomously
without human interaction. It picks up queued tasks, executes them using the
appropriate skills, and handles retries and failures.

---

## Starting the Daemon

### CLI
```bash
agent daemon start    # Start background worker
agent daemon status   # Check if running
agent daemon stop     # Stop the worker
agent daemon logs     # View recent logs
```

### Studio
Navigate to **Daemon** in the sidebar → click **Start Daemon**.

### API
```bash
curl -X POST http://localhost:3333/api/instances/:id/daemon/start
curl http://localhost:3333/api/instances/:id/daemon/status
```

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Goal Store  │ ──→ │   Scheduler  │ ──→ │   Executor  │
│  (SQLite)    │     │  (picks next │     │  (runs task  │
│              │     │   task)      │     │   via skill) │
└─────────────┘     └──────────────┘     └─────────────┘
       ↑                                        │
       └────────── Results Written Back ────────┘
```

1. **Goal Store** holds all goals and tasks in SQLite
2. **Scheduler** polls for the next executable task (respecting dependencies)
3. **Executor** runs the task using the assigned skill
4. Results (success/failure) are written back to the store
5. Goal progress is auto-calculated based on task completion

---

## Task Dependencies

Tasks can depend on other tasks:

```typescript
goalStore.addTask(goalId, "Install dependencies", { skill: "npm-install" });
goalStore.addTask(goalId, "Run tests", {
    skill: "test-runner",
    dependsOn: [1]  // Won't start until task 1 completes
});
```

The scheduler only picks tasks whose dependencies are all `completed`.

---

## Retry & Failure Handling

| Strategy | Behavior |
|----------|----------|
| `retry` | Re-execute the task up to `maxRetries` times |
| `abort` | Stop the entire plan on first failure |
| `skip` | Mark as failed but continue with remaining tasks |

---

## File Watcher

The daemon includes a file watcher (`src/daemon/watcher.ts`) that can trigger
tasks when files change:

```json
{
  "daemon": {
    "watch": ["src/**/*.ts"],
    "onFileChange": "lint-and-test"
  }
}
```

---

## Triggers

Custom triggers (`src/daemon/triggers.ts`) define when tasks should execute:

- **cron** — Schedule tasks on a cron expression
- **file-change** — React to file system events
- **webhook** — HTTP POST triggers task execution
- **manual** — Only execute when explicitly started

---

## Monitoring

### CLI
```bash
agent daemon status    # Running | Stopped, PID, uptime
agent daemon logs      # Last 30 lines of daemon.log
agent goal status 1    # Task-level progress for goal #1
```

### Studio
The Daemon panel provides:
- Live status indicator (green = running)
- Start/Stop buttons
- Color-coded log viewer with auto-refresh
- PID and uptime display
