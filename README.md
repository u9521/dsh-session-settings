# dsh-session-settings

English | [中文](README.zh.md)

**Session Settings, MCP Server, and Skill Management plugin for DeepSeek Harness (DSH) Web GUI.**

Configure per-session or global settings directly from the Web GUI with immediate effect:
1. **Subagent Model & Reasoning Effort**: Independently configure provider, model, and reasoning effort for subagents (`subagent`, `subagent_fork`, `workflow`).
2. **Centralized MCP Server Management**: First-class sidebar navigation item for Model Context Protocol (MCP) servers with 2-stage compatibility probing, automatic protocol downgrade, tool schema inspection, and read-only browsing of resources and prompts.
3. **Session-Level MCP Tool Control**: Granularly enable/disable MCP servers and specific tools per session or follow global defaults.
4. **Session-Level Skill Management & Control**: Independently enable/disable bundled, user, and project skills per session, with automatic dynamic prompt catalog filtering and execution enforcement.

---

## Table of Contents

- [Features](#features)
- [Mainline Compatibility](#mainline-compatibility)
- [Installation](#installation)
  - [🚀 One-Line Quick Install (Recommended)](#-one-line-quick-install-recommended)
  - [Installation from Source (For Developers)](#installation-from-source-for-developers)
- [Plugin Updates & Upgrades](#plugin-updates--upgrades)
  - [Option 1: Online Update (Recommended)](#option-1-online-update-recommended)
  - [Option 2: Local Source Upgrade (For Developers)](#option-2-local-source-upgrade-for-developers)
- [Uninstallation](#uninstallation)
- [Development & Maintenance Commands](#development--maintenance-commands)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
- [License](#license)

---

## Features

- **Settings Sidebar Navigation Entry**: Top-level section in Settings navigation sidebar (dedicated icon) for direct MCP server management.
- **Session-Specific Tab**: Dedicated tab in the conversation view for configuring the active session's subagent models, MCP tools, and skills.
- **Switch-Based Subagent Control**: Three explicit switches — allow agents to choose a subagent model, replace the model of forked subagents, and specify a subagent model with its reasoning effort.
- **Instant Effect**: Each agent's scope layers are re-declared on save and on tool-registry changes, so an updated policy applies on the very next request without restarting DSH.
- **Three Explicit Scopes**: Session, Workspace, and Global are distinct write targets chosen on the page, never inferred from which fields a request happens to carry.
- **New-Session Page Targets a Live Session**: Choosing a workspace on the New-Session page connects that workspace's blank session, and the modal writes session-scope edits straight to it — effective on the next request. A page with no session has no session scope to write to, so that tab disables itself and explains why.
- **Single Interface Contract**: Paths, HTTP methods, and request bodies are each declared once in `src/types.ts`; the client sends and the server validates against the same definitions, with no server-side compatibility branches.
- **Authenticated Routes**: All routes are registered on the official connection carrier, so a request passes the Host/Origin fence and browser authentication before any handler runs.
- **Read-Only Resource & Prompt Browsing**: The MCP server modal offers **Resources** and **Prompts** tabs. Resources are grouped into resources and templates, and a template's parameters are expanded server-side before reading; prompts are shown per role with copy-full-text and a Raw JSON view. Lists are cache-first and content is never persisted — reads happen only on click, and the read-only views never change what the model can see (that stays a session policy decision).

---

## Mainline Compatibility

| Plugin Branch | Compatible DeepSeek Harness (DSH) Mainline | Architecture & Features |
| :--- | :--- | :--- |
| **`main` branch** | **`>= 0.2.0-rc.1`** | Native support for **Session Format V4**, **Cordis 4.0.4**, the `subagent/descriptor` v3 contract, the `AgentPresetRegistry` scope API, and the 0.2.0 `ui-primitives` icon set. |

> **⚠️ Note**: The `main` branch targets DSH 0.2.0-rc.1 and above natively. It keeps **no backward-compatibility shims** and does not support earlier DSH lines. Since DSH 0.2.0 the host no longer reads `engines.dsh`; compatibility is enforced through the `peerDependencies` range on `@deepseek-ai/dsh`, so an incompatible host refuses the plugin instead of loading it half-broken.

---

## Installation

### 🚀 One-Line Quick Install (Recommended)

This repository includes a GitHub Actions workflow that automatically builds and deploys a minimal release to the `dist` branch (containing built artifacts and manifests without raw source bloat).

You can install this plugin with a single command without any local build step:

```sh
dsh plugin --profile web add github:u9521/dsh-session-settings#dist
```

> **Note**: After installation, start or restart the Web service:
> ```sh
> dsh web
> ```

---

### Installation from Source (For Developers)

#### Step 1: Obtain the Source Code

Clone the repository to your local machine:

```sh
mkdir -p ~/.dsh/plugins
cd ~/.dsh/plugins

git clone https://github.com/u9521/dsh-session-settings.git
cd dsh-session-settings
```

#### Step 2: Install Dependencies & Build

```sh
pnpm install
pnpm run build
```

#### Step 3: Register to DSH Web Profile

```sh
dsh plugin --profile web add .
```

##### Verify Installation
List the plugins in the `web` profile to verify that `@local/dsh-session-settings` is registered:

```sh
dsh plugin --profile web list
```

#### Step 4: Start and Verify

```sh
dsh web
```

---

## Plugin Updates & Upgrades

### Option 1: Online Update (Recommended)

If you installed via the one-line command from the GitHub dist branch, update directly using `dsh plugin --profile web update`:

```sh
dsh plugin --profile web update github:u9521/dsh-session-settings#dist
```

> **Note**: After updating, start or restart the Web service:
> ```sh
> dsh web
> ```

---

### Option 2: Local Source Upgrade (For Developers)

If you installed from cloned local source, pull the latest commits from the `main` branch and rebuild:

```sh
# Step 1: Navigate to the plugin source directory
cd ~/.dsh/plugins/dsh-session-settings

# Step 2: Pull latest commits from the main branch
git pull origin main

# Step 3: Update dependencies and rebuild artifacts
pnpm install
pnpm run build

# Step 4: Restart the Web service
dsh web
```

---

## Uninstallation

To disable and completely remove the plugin, use the DSH CLI to remove it from the `web` profile:

```sh
dsh plugin --profile web remove @local/dsh-session-settings
```

> **Note**: If installed via the GitHub specifier, you can also run:
> ```sh
> dsh plugin --profile web remove github:u9521/dsh-session-settings#dist
> ```
> After uninstallation, start or restart `dsh web` to return to the default DSH interface.

---

## Development & Maintenance Commands

| Command | Description |
| :--- | :--- |
| `pnpm run build` | Full build (runs `tsc` type check + generates `lib/` bundles) |
| `pnpm run check` | Type check only (`tsc --noEmit`) without emitting files |
| `pnpm run fmt` | Format source code and configuration files with Prettier |
| `pnpm run fmt:check` | Check code formatting compliance |
| `pnpm run verify:gates` | Run the zero-dependency documentation and convention gates |
| `pnpm run verify` | Aggregate pre-commit check (`check` + `verify:gates`) |

---

## Frequently Asked Questions (FAQ)

### Q1: Do I need to restart `dsh web` after updating session settings or disabling tools/skills?
**A**: No. The host plugin declares each agent's policy on that agent's own scope (tool restrictions, execution guards, and scoped prompt sections) and re-declares it when you save. As soon as you save settings in the Web GUI, they take effect on the very next request.

### Q2: What happens if I save session settings before the session exists?
**A**: On the New-Session page a blank session already exists as soon as a workspace is connected, so session-scope edits are written to that session and take effect on the next request. On a page with no session at all there is nothing to write to: the Session tab is disabled and a note beside the tabs says so. Workspace and Global defaults remain editable there. Nothing is ever staged or retargeted — a save lands only on the scope you selected.

### Q3: Are the plugin's API routes authenticated?
**A**: Yes. All routes are registered through the official connection carrier, so an unauthenticated request receives `401` before any handler runs. The plugin holds no credentials of its own.

### Q4: How do I uninstall or remove the plugin?
**A**: See the [Uninstallation](#uninstallation) section above and run `dsh plugin --profile web remove` from the corresponding profile.

---

## License

This project is licensed under the [MIT License](LICENSE).
