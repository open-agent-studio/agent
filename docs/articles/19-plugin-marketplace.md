# Plugin Marketplace

Agent Runtime isn't just an extensible framework, but a living ecosystem. The `PluginLoader`, `CommandLoader`, and `HookRegistry` enable community developers to pack their new Tools, APIs, and Workflow Scripts into a single distributable node project.

---

## 1. Web Marketplace

You can explore popular community plugins, official integrations, and trending agent templates via the [Open Agent Studio Marketplace](https://openagentstudio.org/marketplace) URL.

The web UI provides quick install commands, search functionalities across verified packages, categorized tags, and comprehensive ratings.

## 2. CLI Installations

The CLI makes installing any plugin frictionless, whether it exists on Github natively, in the Agent Skills registry, or as a local repository folder on your machine.

### Discover Plugins Natively

```bash
$ agent plugins search "database"

🔍 Searching Agent Hub (via agent-skills) for plugins matching "database"...

  Found 1 plugin(s):

  postgres-connector v1.0.0 [Database]
    Direct database access, raw queries, and schema introspection.
    Install: agent plugins install postgres-connector
```

### Install From the Hub

```bash
$ agent plugins install postgres-connector
```

### Install From Web / GitHub

When you find a new plugin URL online, you do not have to download it manually. Agent Runtime natively detects Git URLs and clones the module specifically into your `.agent/plugins/` folder to securely sandbox new components.

```bash
$ agent plugins install https://github.com/open-agent-studio/postgres-connector
```

## 3. List and Manage

```bash
$ agent plugins list

🔌 Installed Plugins (1)

  postgres-connector v1.0.0
    Direct database access, raw queries, and schema introspection.
    Provides: 3 commands, 1 hooks, 2 skills
```

```bash
$ agent plugins remove postgres-connector
```
