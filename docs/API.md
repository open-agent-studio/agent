# Agent Studio REST API Reference

> Complete reference for all Studio server endpoints.

Base URL: `http://localhost:3333`

---

## Instances

### List Active Instances
```
GET /api/instances
```
**Response:**
```json
[
  {
    "id": "repl-abc123",
    "pid": 12345,
    "cwd": "/home/user/my-project",
    "project": "my-project",
    "model": "gpt-4o",
    "startedAt": "2025-01-01T00:00:00Z"
  }
]
```

### Get Instance
```
GET /api/instances/:id
```

---

## Goals

### List Goals with Tasks
```
GET /api/instances/:id/goals
```
**Response:**
```json
{
  "stats": {
    "activeGoals": 2,
    "completedGoals": 5,
    "pendingTasks": 3,
    "runningTasks": 1,
    "completedTasks": 12,
    "failedTasks": 0,
    "awaitingApproval": 1
  },
  "goals": [
    {
      "id": 1,
      "title": "Build auth module",
      "status": "active",
      "priority": 1,
      "tasks": [
        { "id": 1, "title": "Install JWT package", "status": "completed" },
        { "id": 2, "title": "Write auth middleware", "status": "running" }
      ]
    }
  ]
}
```

### Create Goal
```
POST /api/instances/:id/goals
Content-Type: application/json

{
  "title": "Build authentication",
  "description": "Implement JWT-based auth",
  "priority": 1,
  "deadline": "2025-02-01"
}
```

### Update Goal Status
```
PUT /api/instances/:id/goals/:goalId/status
Content-Type: application/json

{ "status": "paused" }
```
Valid statuses: `active`, `paused`, `completed`, `failed`, `cancelled`

### Delete Goal
```
DELETE /api/instances/:id/goals/:goalId
```

### Add Task to Goal
```
POST /api/instances/:id/goals/:goalId/tasks
Content-Type: application/json

{
  "title": "Install dependencies",
  "description": "Run npm install for auth packages",
  "skill": "npm-install",
  "dependsOn": [],
  "requiresApproval": false
}
```

### Approve Task
```
POST /api/instances/:id/tasks/:taskId/approve
```

---

## Memory

### List Memories
```
GET /api/instances/:id/memory
```

### Search Memories (FTS5)
```
GET /api/instances/:id/memory/search?q=database
```

### Add Memory
```
POST /api/instances/:id/memory
Content-Type: application/json

{
  "content": "Staging server is at 10.0.0.5",
  "category": "fact",
  "tags": ["infra", "staging"]
}
```
Categories: `general`, `fact`, `project`, `preference`, `learned`

### Delete Memory
```
DELETE /api/instances/:id/memory/:memoryId
```

---

## Skills

### List Skills
```
GET /api/instances/:id/skills
```

### Create Skill
```
POST /api/instances/:id/skills
Content-Type: application/json

{
  "name": "my-skill",
  "description": "Does amazing things",
  "prompt": "# My Skill\n\nInstructions here...",
  "tools": ["fs.read", "fs.write"]
}
```

### Update Skill
```
PUT /api/instances/:id/skills/:name
Content-Type: application/json

{
  "prompt": "# Updated prompt content",
  "description": "Updated description",
  "tools": ["fs.read", "fs.write", "cmd.run"]
}
```

### Delete Skill
```
DELETE /api/instances/:id/skills/:name
```

---

## Commands

### List Commands
```
GET /api/instances/:id/commands
```

### Create Command
```
POST /api/instances/:id/commands
Content-Type: application/json

{
  "name": "deploy-staging",
  "description": "Deploy to staging environment",
  "tools": ["cmd.run", "git.status"],
  "body": "# Deploy\n1. Run tests\n2. Build\n3. Push to staging"
}
```

### Delete Command
```
DELETE /api/instances/:id/commands/:name
```

---

## Scripts

### List Scripts
```
GET /api/instances/:id/scripts
```

### Create Script
```
POST /api/instances/:id/scripts
Content-Type: application/json

{
  "name": "backup-db",
  "description": "Backup the database",
  "entrypoint": "run.sh",
  "content": "#!/bin/bash\npg_dump mydb > backup.sql"
}
```

### Delete Script
```
DELETE /api/instances/:id/scripts/:name
```

---

## Plugins

### List Plugins
```
GET /api/instances/:id/plugins
```

### Remove Plugin
```
DELETE /api/instances/:id/plugins/:name
```

---

## Daemon

### Get Status
```
GET /api/instances/:id/daemon/status
```
**Response:**
```json
{ "running": true, "pid": 54321 }
```

### Start Daemon
```
POST /api/instances/:id/daemon/start
```

### Stop Daemon
```
POST /api/instances/:id/daemon/stop
```

### Get Logs
```
GET /api/instances/:id/daemon/logs?lines=50
```

---

## Capabilities (Read-Only)

### Get All Capabilities
```
GET /api/instances/:id/capabilities
```
Returns skills, commands, scripts, and plugins in a single response.

---

## WebSocket Events

Connect via Socket.IO at `ws://localhost:3333`.

| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe` | Client → Server | `instanceId: string` |
| `agent:log` | Agent → UI | `{ instanceId, text, type }` |
| `agent:command` | UI → Agent | `{ instanceId, command }` |
| `agent:approval:request` | Agent → UI | `{ instanceId, action }` |
| `agent:approval:response` | UI → Agent | `{ instanceId, tool, approved }` |
