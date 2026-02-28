# LLM Providers — Configuration & Routing

> How the Agent Runtime connects to multiple AI providers with automatic fallback.

---

## Supported Providers

| Provider | Module | SDK | Environment Variable |
|----------|--------|-----|---------------------|
| **OpenAI** | `openai.ts` | `openai` | `OPENAI_API_KEY` |
| **Azure OpenAI** | `azure.ts` | `openai` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` |
| **Anthropic** | `anthropic.ts` | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` |
| **Ollama** | `ollama.ts` | HTTP fetch | — (local, port 11434) |

---

## Configuration

Set your preferred provider and model in `agent.config.json` or `.agent/config.json`:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.2,
    "maxTokens": 4096
  }
}
```

### Provider-Specific Config

**OpenAI / Azure:**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "sk-..."
  }
}
```

**Anthropic:**
```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "sk-ant-..."
  }
}
```

**Ollama (local):**
```json
{
  "llm": {
    "provider": "ollama",
    "model": "llama3",
    "baseUrl": "http://localhost:11434"
  }
}
```

API keys can also be set via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).
Environment variables take precedence over config file values.

---

## LLM Router

The **LLM Router** (`src/llm/router.ts`) is the core abstraction that:

1. Selects the correct provider adapter based on config
2. Sanitizes tool names for provider compatibility (e.g., dots → underscores for OpenAI)
3. Forwards chat requests with the full message history
4. Handles tool call serialization for each provider's expected format

### Tool Name Sanitization

Different providers have different naming rules. The router automatically transforms:
- `fs.read` → `fs_read` (for OpenAI/Azure which reject dots)
- Tool calls in conversation history are also sanitized to maintain consistency

### Message Mapping

Each provider adapter maps the internal message format to the provider-specific API:

| Internal | OpenAI | Anthropic | Ollama |
|----------|--------|-----------|--------|
| `role: 'tool'` | `role: 'tool'` | `role: 'user'` + `tool_result` block | `role: 'tool'` |
| `toolCalls` on assistant | `tool_calls` array | `tool_use` content blocks | `tool_calls` array |
| System message | `role: 'system'` | `system` parameter | `role: 'system'` |

---

## Fallback Chain

The router supports fallback to local models when cloud providers fail:

```
openai/gpt-4o  →  anthropic/claude-sonnet  →  ollama/llama3
```

If the primary provider returns an error or times out, the router automatically
retries with the next provider in the chain.

---

## Adding a New Provider

1. Create `src/llm/providers/my-provider.ts`
2. Implement the `LLMProvider` interface with a `chat(request)` method
3. Map messages from internal format to provider format
4. Register in `src/llm/router.ts`
