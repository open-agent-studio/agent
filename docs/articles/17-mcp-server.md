# MCP Server Integration

Agent Runtime operates beautifully as a CLI or Web Dashboard. However, its modular tools, dynamic memory stores, and learned agent skills can also be plugged directly into modern IDEs (like Cursor, Windsurf, or Zed) that support the **Model Context Protocol** (MCP).

---

## 1. What is MCP?

The Model Context Protocol (MCP) allows your local AI models within editors to "talk" to the tools, files, and state of an external agent backend. Instead of relying solely on the IDE's built-in abilities, Agent Runtime can serve as a massive external capability extension.

We support mapping our architecture to MCP's core features:
- **Tools**: Re-exporting Agent Studio tools (shell, file read/write, browser automation, Docker).
- **Resources**: Streaming dynamic workspace files, as well as accessing internal `MemoryStore` data (project facts and developer knowledge) over `memory://all`.
- **Prompts**: Turning installed Agent Runtime skills (e.g. `reviewer`, `coder`) into reusable templates inside the IDE.

## 2. Modes of Operation

Agent Runtime's MCP Server supports two modes:

### Standard I/O (stdio)
Use the `stdio` transport to attach your editor directly to a local Agent Runtime.

```bash
$ agent mcp --stdio
```

> In your IDE, configure an MCP connection by specifying the absolute path to your `agent` binary and the `mcp --stdio` argument.

### HTTP / Server-Sent Events
Run the MCP Server over HTTP for cross-device access or remote server setups.

```bash
# Serves an SSE endpoint on port 3100
$ agent mcp --http 3100
```

> **Client connection URL:** `http://localhost:3100/sse`

Your IDE or another MCP client can then open this SSE stream to interact seamlessly with Agent Studio.
