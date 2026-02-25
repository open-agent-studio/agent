# The Scripts System (Part 8)

In the previous parts, we explored how the Agent can execute tasks using **Skills** (complex, LLM-powered capabilities) and **Commands** (lightweight LLM templates). But what if you have a task that doesn't need AI at all? What if you just want to run a deterministic, repeatable shell or Node script, but still have it integrated into the agent's ecosystem?

In **v0.9.0**, we introduced the **Scripts System**—a way to define and run raw, non-LLM automation tasks as first-class citizens in the Agent Runtime.

---

## 📜 Why Mingle Scripts with AI?

There are many tasks where an LLM is overkill, slow, or too unpredictable:
1. Running a build pipeline (`npm run build`).
2. Deploying a branch to staging (`git push origin HEAD:staging`).
3. Running a database migration.

By formalizing scripts in the Agent Runtime:
* **Discoverability:** The user can see all available scripts via `agent scripts list` or `/scripts` in the REPL.
* **LLM Awareness:** The LLM knows about these scripts. If a user says "deploy to staging", the LLM can see the `deploy-staging` script in its prompt and run it via `cmd.run`, rather than trying to guess the commands.
* **Structured Arguments:** You can enforce required arguments and defaults (`--branch develop`).
* **Packaging:** Scripts can be bundled inside Plugins alongside Skills and Commands.

---

## 🛠️ Defining a Script

A script consists of a `script.yaml` manifest and an entrypoint file (like a `.sh` or `.ts` file). They live in `.agent/scripts/<name>/`.

### Example: `.agent/scripts/deploy-staging/script.yaml`

```yaml
name: deploy-staging
description: Build and deploy current branch to staging
version: 1.0.0
entrypoint: deploy.sh
confirm: true
timeout: 120000
tags: [deploy, staging, ci]

env:
  NODE_ENV: production
  DEPLOY_TARGET: staging

args:
  branch:
    description: Branch to deploy
    default: main
    required: false
  skip-tests:
    description: Skip the test suite before deploying
    type: boolean
    default: false
```

### The Entrypoint: `deploy.sh`

The runner automatically injects arguments as `SCRIPT_ARG_*` environment variables.

```bash
#!/bin/bash
set -e

echo "🚀 Deploy to Staging"
echo "Branch:     ${SCRIPT_ARG_BRANCH}"
echo "Skip Tests: ${SCRIPT_ARG_SKIP_TESTS}"

if [ "$SCRIPT_ARG_SKIP_TESTS" != "true" ]; then
    npm test
fi

npm run build
git push origin HEAD:staging
```

---

## 🏃 Execution & Auto-Detection

When you execute a script, the runner spins up a child process. It determines the interpreter cleanly based on the file extension:
* `.sh` / `.bash` → `bash`
* `.ts` / `.mts` → `npx tsx`
* `.js` / `.mjs` → `node`
* `.py` → `python3`
* No extension → Exectued directly (must be executable)

You can override this by setting `interpreter: python3` in the manifest.

### Execution Context

The execution provides standard isolation:
* **Timeouts:** Long-running scripts are killed automatically based on `timeout` in the manifest.
* **Working Directory:** Executes in the project directory, resolving any relative `cwd` parameters.
* **Confirmation:** If `confirm: true` is set, the CLI prompts the user before executing.

---

## 💬 The Resolution Chain (How the Agent Decides)

When you type something into the CLI like `agent run deploy-staging`, the runtime follows an exact resolution chain to handle ambiguity:

1. **Explicit Skill Flag:** `agent run -s my-skill deploy` → Runs `my-skill`.
2. **Command Name Match:** Does `.agent/commands/deploy-staging.md` exist? → Runs the command template through the LLM.
3. **Script Name Match:** Does `.agent/scripts/deploy-staging/script.yaml` exist? → Spawns the script directly natively, bypassing the LLM.
4. **General Goal:** If no match is found, it sends "deploy-staging" as a natural language goal to the LLM agentic loop.

In the REPL, you can call scripts directly using slash commands:
```text
> /scripts
  📜 Scripts (1)
    deploy-staging — Build and deploy current branch to staging

> agent scripts run deploy-staging --branch canary
```

By adding scripts to the ecosystem, the Agent Runtime becomes a unified hub for *all* project automation—balancing the creativity of LLM-driven Tasks with the rock-solid reliability of deterministic Shell scripts.
