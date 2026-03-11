# Multi-Agent Swarm

A single agent struggles with complex objectives because they lack specialization and run out of context. Agent Runtime's built-in **Swarm Orchestrator** solves this by instantiating role-specific agents that work in tandem across a shared message bus to achieve long-term goals.

---

## 1. Starting a Swarm locally

If you have a massive goal (like refactoring an enormous codebase or researching a multi-step technology stack), the Swarm architecture spins up a *Planner* agent. The Planner breaks down the goal into `AgentTasks` and dynamically spawns specialized sub-agents.

```bash
# Starts a local swarm session utilizing up to 3 specialized agents
$ agent swarm start "Refactor the database schema" --max-agents 3 --model gpt-4o
```

As the task executes, you can monitor the real-time status of all active local agents via:

```bash
$ agent swarm status

🐝 Swarm Status
──────────────────────────────────────────────────
  Session:  a1b2c3d4e5f6
  Status:   running
  Goal:     Refactor the database schema...
  Uptime:   1m 24s

  Agents:
    ⚡ 1234abcd [planner] busy
    ⚡ 5678efgh [coder] busy
    💤 9012ijkl [reviewer] idle

  Tasks:
    ✅ d1 [planner] Analyze old schema
    🔄 c2 [coder] Write migration scripts
    ⏳ r3 [reviewer] Verify data safety
```

## 2. Remote Delegation

You don't need to limit your Swarm to the CPU/API keys of the machine you started it on. If you span operations across hybrid infrastructure, the `SwarmOrchestrator` can delegate computing tasks off-device using a `RemoteAgentBridge`.

```bash
$ agent swarm add-remote http://10.0.0.5:3334 coder \
    --name "MacBook Pro" \
    --key oas_abcd123
```

This binds an active, authenticated remote Agent Runtime server to your ongoing Swarm session.

When the Orchestrator assigns a task to that specific `coder` agent, the command is serialized and forwarded over HTTP Server-Sent Events to the remote machine for execution. Once the remote completion fires, the result acts exactly like local execution on the message bus.
