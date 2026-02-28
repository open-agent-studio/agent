# Policy & Approvals — Permission-Gated Execution

> How the Agent Runtime keeps humans in the loop for sensitive operations.

---

## Overview

The Agent Runtime uses a **Policy Engine** to gate tool execution. Every tool action
passes through a permission check, and high-risk operations require explicit human
approval before proceeding.

---

## Risk Levels

Tools are categorized into risk levels:

| Level | Examples | Behavior |
|-------|----------|----------|
| **low** | `fs.read`, `project.detect` | Auto-approved, no prompt |
| **medium** | `fs.write`, `git.status` | Logged, may require approval based on policy |
| **high** | `cmd.run`, `git.push` | Always requires human approval |
| **critical** | `fs.delete`, system-level ops | Always requires approval + confirmation |

---

## Approval Flow

### CLI Mode

When a tool requires approval in the interactive REPL:

```
  ⚡ cmd.run("npm install express")
  ⚠ This action requires approval.
  Allow? (y/n) ▊
```

The REPL pauses execution, displays the tool name and arguments, and waits for
the user to approve (`y`) or deny (`n`).

### Studio Mode (Remote Approval)

When running via daemon or in a remote session, approval requests are relayed
via WebSocket to the Studio UI:

```
Agent CLI  →  Socket.IO  →  Studio Server  →  Browser UI
                                    ↓
                            Approval Button
                                    ↓
Agent CLI  ←  Socket.IO  ←  Studio Server  ←  User clicks "Allow"
```

The Studio console shows an approval card with:
- Tool name and arguments
- Risk level badge
- **Allow** / **Deny** buttons

---

## Configuration

Customize the policy in `.agent/config.json`:

```json
{
  "policy": {
    "autoAllow": ["fs.read", "fs.list", "project.detect"],
    "alwaysAsk": ["cmd.run", "fs.delete"],
    "denyList": ["cmd.run:rm -rf /"]
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `autoAllow` | Tools that never require approval |
| `alwaysAsk` | Tools that always require approval regardless of risk level |
| `denyList` | Specific tool+args combinations that are always denied |

---

## Audit Trail

Every tool execution is logged to the audit system:

- **Tool name** and arguments
- **Approval status** (auto-approved, human-approved, denied)
- **Timestamp** and **run ID**
- **Duration** and result

Access audit logs via:
```bash
agent memory search "audit"
# or in Studio → Memory Explorer → search "audit"
```

---

## Task-Level Approval

Goals can mark individual tasks as requiring approval:

```typescript
goalStore.addTask(goalId, "Deploy to production", {
    requiresApproval: true,
    skill: "deploy-staging"
});
```

These tasks enter a `pending` state until approved via:
- CLI: `agent goal approve <taskId>`
- Studio: Goals panel → Approve button
- API: `POST /api/instances/:id/tasks/:taskId/approve`
