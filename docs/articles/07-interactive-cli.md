# The Interactive CLI: A Claude Code-Style Experience (Part 7)

In **Part 6**, we gave the agent extensibility. In **Part 7**, we give it a personality.

Most CLI tools are fire-and-forget: you type a command, get output, done. But modern AI agents deserve a **conversational interface**—one where you stay in a flow, the agent remembers context, and you can guide it naturally.

## 🤖 The REPL

When you type `agent` with no subcommand, you enter **Interactive Mode**:

```
$ agent

  ╭────────────────────────────────────────────────╮
  │  🤖 Agent Runtime v0.8.0                       │
  │    Project: my-app                              │
  │    Model: gpt-4o │ 3 skills │ 2 commands        │
  ╰────────────────────────────────────────────────╯

  Type a goal, a /command, or /help for help.

  > Add input validation to the signup form
  ⠋ Thinking...
  ⚡ fs.read(src/pages/signup.tsx) ✓
  ⚡ fs.write(src/pages/signup.tsx) ✓
  ⚡ cmd.run(npm test) ✓

  Added Zod validation schema for email and password fields.
  Tests pass.

  ────────────────────────────────────────────────────────
  ✓ Done (8.2s)

  > Now add rate limiting to the API endpoint
  ⠋ Thinking...
```

Notice the second prompt: **the agent remembers** the first task. It knows you're working on the signup form and can connect the two requests.

## 🔑 Key Features

### 1. Multi-Turn Conversation

Unlike `agent run "do X"` (which is one-shot), the REPL maintains conversation history across turns. The `ConversationManager` (`src/cli/conversation.ts`) tracks all messages:

```typescript
conversation.addUser("Add validation");
// → LLM sees full history including previous turns
const messages = conversation.getMessages();
```

When context gets too long, use `/compact` to summarize and trim:
```
  > /compact
  Conversation compacted. Context freed.
```

### 2. Slash Commands

Type `/` to access built-in commands:

| Command | What it does |
|---------|-------------|
| `/help` | Show all available commands |
| `/skills` | List installed skills with status |
| `/commands` | List available lightweight commands |
| `/hooks` | Show registered lifecycle hooks |
| `/model` | Display current model and providers |
| `/compact` | Summarize and trim conversation context |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit interactive mode |

Your custom `.agent/commands/*.md` files are also available as slash commands! If you have `deploy-staging.md`, you can type `/deploy-staging`.

### 3. Tab Completion

Press `Tab` after `/` to see all available slash commands. The REPL uses readline's `completer` for instant autocompletion:

```
  > /sk<TAB>
  > /skills
```

### 4. Inline Tool Execution

When the agent calls tools, you see them in real-time with status badges:

```
  ⚡ fs.read(src/auth/handler.ts) ✓         # Success
  ⚡ cmd.run(npm test) ✗ Test failed        # Failure with reason
  ⚡ cli.cursor(refactor auth...) ✓          # Delegated to external CLI
```

### 5. Rich Welcome Banner

The bordered banner shows at-a-glance info:
- Current project name (from `package.json`)
- Active LLM model
- Number of loaded skills and commands

## 🏗️ Architecture

```
bin/agent.ts
  └── No subcommand?
      └── startREPL() ← src/cli/repl.ts
          ├── Bootstrap (config, tools, skills, commands, hooks)
          ├── renderBanner()
          └── readline loop
              ├── /slash-command → SlashCommandRegistry
              ├── /user-command → CommandLoader → LLM loop (scoped tools)
              └── natural language → ConversationManager → LLM loop (all tools)
```

All existing subcommands (`agent run`, `agent plan`, `agent skills`) continue to work exactly as before. The REPL is an *additional* entry point, not a replacement.

## 💻 Implementation Highlights

### Spinner Integration

We use `ora` for smooth loading states:
```typescript
const spinner = new Spinner();
spinner.start('Thinking...');
// ... LLM call ...
spinner.stop();
```

### Tool Call Display

The `renderToolCall` function shows tool execution inline:
```typescript
renderToolCall('fs.read', { path: 'src/app.ts' }, 'running');
// Output: ⚡ fs.read({"path":"src/app.ts"})
// Then on completion:
renderToolCall('fs.read', args, 'success');
// Output: ✓
```

### Backward Compatibility

The entry point (`bin/agent.ts`) detects whether a subcommand was provided:
```typescript
const hasSubcommand = args.length > 0 && !args[0].startsWith('-');
if (hasSubcommand) {
    program.parse(process.argv);  // Traditional CLI
} else {
    startREPL();  // Interactive mode
}
```

## 🚀 What's Next?

The interactive CLI opens up new possibilities:
- **Streaming responses** — Show LLM output character-by-character
- **Checkpointing** — Rewind codebase to a previous state within a session
- **Project Memory** — Automatic `.agent.md` files for project-specific context
- **Multi-agent mode** — Spawn sub-agents for parallel tasks within the REPL

---

### 📚 Full Series

1. **Architecture & Vision**
2. **The Brain (Goal Decomposition)**
3. **The Body (Skill Execution)**
4. **The Memory (Persistence)**
5. **Self-Improvement (Auto-Fixer)**
6. **Plugin Ecosystem (Hooks, Commands, Multi-CLI)**
7. **Interactive CLI (This Article)**

Explore the source code at [GitHub](https://github.com/open-agent-studio/agent) or install with `npm i -g @open-agent-studio/agent`.
