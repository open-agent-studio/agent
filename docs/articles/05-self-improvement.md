# Building Self-Improvement: The Auto-Fixer (Part 5/5)

In **Part 1-4**, we built an agent that can plan, execute, and remember. But like any junior developer, it will make mistakes.

What if the `npm-install` skill breaks because of a new error message format?

Normally, you'd fix the code. But an **Autonomous Agent** should fix *itself*.

## ❤️ The Metrics

First, we need to know something is broken. We track **Skill Metrics** (`src/memory/store.ts`):

```sql
CREATE TABLE skill_metrics (
    skill TEXT PRIMARY KEY,
    calls INTEGER DEFAULT 0,
    successes INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0
);
```

Whenever a skill runs, we record the outcome:
- **Success Rate**: `successes / calls`
- **Avg Duration**: `total_duration_ms / calls`

If `git-commit` fails 5 times in a row, its success rate drops below 20%. This triggers an alert.

## 🩺 The Doctor

We built `src/skills/doctor.ts`. Its job is to diagnose failing skills.

1.  **Check Metrics**: Find skills with >5 failures or <50% success rate.
2.  **Analyze Logs**: Retrieve specific error messages (e.g., "fatal: not a git repository").
3.  **Generate Report**: "Skill `git-commit` is failing because it's running outside a repo."

## 🔧 The Auto-Fixer

The magic happens in `doctor.fix(skillName)`. It uses the LLM to patch the code.

### 1. Construct Prompt
```typescript
const prompt = `You act as an AI Tool Developer.
The skill "${skillName}" is failing repeatedly.

Current Source (prompt.md):
${currentCode}

Recent Errors:
- ${error1}
- ${error2}

Rewrite the prompt to handle these errors.`;
```

### 2. Generate Patch
The LLM reads the errors ("not a git repository") and decides to add a check:
```markdown
# Git Commit Skill
## Updated Instructions
1. Run `git status` first to verify repo.
2. If distinct, add changes.
3. Commit.
```

### 3. Apply & Reload
The agent overwrites `prompt.md` with the new version and reloads the skill instantly. The next execution uses the fixed logic.

## 🚀 But Wait, There's More

In **v0.8.0**, we took everything further. The agent is now extensible and conversational.

In **Part 6**, we'll cover the **Plugin Ecosystem**—hooks that intercept execution, lightweight commands, and multi-CLI orchestration.
In **Part 7**, we'll build the **Interactive CLI**—a Claude Code-style conversational experience.

### 📚 Series Recap

- **Part 1**: Architecture & Vision
- **Part 2**: The Brain (Goal Decomposition)
- **Part 3**: The Body (Skill Execution)
- **Part 4**: The Memory (Persistence)
- **Part 5**: Self-Improvement (Auto-Fixer)
- **Part 6**: Plugin Ecosystem (Hooks, Commands, Multi-CLI)
- **Part 7**: Interactive CLI

You can explore the full source code and contribute at [GitHub](https://github.com/open-agent-studio/agent).

Happy Hacking!
