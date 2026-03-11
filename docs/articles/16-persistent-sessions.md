# Persistent Agent Sessions

Agent Runtime gives you an interactive, persistent REPL where you can chat natively with the agent. Behind the scenes, we use an embedded SQLite database (`memory.db`) to ensure your conversations survive restarts, power failures, or the end of the work day.

---

## 1. Entering the Interactive REPL

Running the CLI with no arguments drops you into the interactive prompt. 

```bash
$ agent

> Write a script to monitor memory usage
```

Every command, response, and tool interaction you have within the terminal is continuously saved to the `SessionStore`.

## 2. Managing Sessions

You can view your history of agent sessions using the CLI:

```bash
$ agent sessions list

💾 Saved Sessions
──────────────────────────────────────────────────────────────────
ID        Name                 Turns  Status     Last Active
──────────────────────────────────────────────────────────────────
bed51964  Bug Hunt             14     active     3/11/2026, 4:50 PM
1a2b3c4d  <unnamed>            2      completed  3/10/2026, 1:15 PM
```

## 3. Resuming Sessions

To pick up exactly where you left off, resume a previous session by its ID. The agent will read its entire memory history and understand exactly what it was doing before.

### From the REPL

```bash
$ agent sessions resume bed51964
```

### From a One-Shot Run

You can also continue a conversation non-interactively.

```bash
$ agent run "Did you finish the bug hunt?" --session bed51964
```

### Naming Sessions

To make them easier to find later, you can name sessions when you begin them:

```bash
$ agent run "Let's track down the memory leak" --session-name "Bug Hunt"
```

## 4. Exporting Data

If you need to share a log of how an agent solved a problem, you can export the raw SQLite session into human-readable JSON:

```bash
$ agent sessions export bed51964
✓ Session exported to session-bed51964.json
```

To clean up your SQLite database, simply delete old sessions:

```bash
$ agent sessions delete bed51964
```
