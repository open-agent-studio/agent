# API Authentication

As your Agent runs autonomously, it naturally handles sensitive tasks, touches your file system, and may even execute tasks on remote servers you own. When exposing your agent's remote execution endpoint (`/api/execute`), ensuring only authorized users can dispatch tasks is critical.

Agent Runtime features built-in API key management to secure your self-hosted agent endpoints.

---

## 1. Creating API Keys

To generate a new API key for remote access, use the `api-keys create` command:

```bash
$ agent api-keys create --name "My MacBook Pro"
```

**Output:**
```
✓ Created API Key (My MacBook Pro)

  Key ID:     oas_key_1a2b3c4d5e
  API Key:    oas_9f8e7d... (KEEP THIS SECRET)
```

> **Important**: The raw API key (`oas_...`) is only shown once. Ensure you save it securely. The agent only stores a SHA-256 hash of the key.

## 2. Managing API Keys

List all active keys, along with when they were last used:

```bash
$ agent api-keys list
```

Revoke a key immediately if you suspect it has been compromised or is no longer needed:

```bash
$ agent api-keys revoke oas_key_1a2b3c4d5e
```

## 3. Using API Keys on the Server

When you start Agent Studio on a remote server, the `/api/execute` endpoint is automatically protected by your generated keys.

```bash
# Start the studio on your server
$ agent studio --port 3334
```

Any client attempting to execute tasks must provide the API key as a Bearer Token:

```bash
$ curl -X POST http://your-server:3334/api/execute \
    -H "Authorization: Bearer oas_9f8e7d..." \
    -H "Content-Type: application/json" \
    -d '{"goal": "Check disk space"}'
```

Without a valid key, the server will immediately reject the request with a `401 Unauthorized` response.

## 4. Connecting with the CLI

If you are using the CLI to trigger a remote run, you can pass the key using the `--remote-key` flag:

```bash
$ agent run "Deploy the application to staging" \
    --remote http://your-server:3334 \
    --remote-key oas_9f8e7d...
```

If you frequently connect to the same remote, you can configure it via environment variables or set it up securely in your swarm orchestrator settings to avoid passing secrets via your shell history.
