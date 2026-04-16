# Claude Code ToolBox

**VS Code extension + monorepo:** [`Claude-Code-ToolBox`](https://github.com/amitchorasiya/Claude-Code-ToolBox) on GitHub · **License:** [MIT](LICENSE) · **VS Code Marketplace id:** `amitchorasiya.claude-code-toolbox-vscode` · **Listing title:** *Claude Code ToolBox (MCP, Skills, Cursor/Copilot → Claude)* · **Versions:** VS Code extension **`1.0.9`** · JetBrains plugin **`0.6.10`** (plugin id `com.amitchorasiya.claude.code.toolbox`)

**Install:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) · [`vscode:` deep link](vscode:extension/amitchorasiya.claude-code-toolbox-vscode) · JetBrains: [Search Marketplace](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) · [`jetbrains://` install (opens IDE)](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.claude.code.toolbox) · [IntelliJ sources & build](packages/claude-code-toolbox-intellij/)

## IDE support

| IDE | Status | Install |
|-----|--------|---------|
| **Visual Studio Code** | **Shipping** — full MCP & skills hub | [Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.cloude-code-toolbox-vscode) · id **`amitchorasiya.cloude-code-toolbox-vscode`** |
| **JetBrains (IntelliJ IDEA, PyCharm, …)** | **Preview** — JCEF hub + parity work in [`packages/claude-code-toolbox-intellij/`](packages/claude-code-toolbox-intellij/); build with `./gradlew buildPlugin` (JDK 21) or install from Marketplace / ZIP | [Marketplace search](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) · [`jetbrains://…`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.claude.code.toolbox) |

See also: [IntelliJ package README](packages/cloude-code-toolbox-intellij/README.md).

## After install: open Cloude Code ToolBox (VS Code)

**There is no separate desktop app for the VS Code experience**—that extension runs **inside Visual Studio Code**. The JetBrains build is a separate plugin install (preview); see the table above.

1. **Install** from the Marketplace (search for the listing title **Cloude Code ToolBox (MCP, Skills, Cursor/Copilot → Claude)**) or from a `.vsix`. If VS Code prompts you, **reload the window** (**Developer: Reload Window**).
2. Find the **Activity Bar**: the **narrow column of icons on the far left** of the VS Code window (Explorer, Search, Source Control, …).
3. Click the **Cloude Code ToolBox** icon added by this extension. The **Side Bar** opens next to it.
4. In the Side Bar, click **MCP & skills**. That opens the **hub** (webview) with tabs **Intelligence**, **MCP**, **Skills**, and **Workspace**—that is the main surface for MCP, skills, and setup flows.

**Don’t see the icon?** Press **Ctrl+Shift+P** (Windows/Linux) or **⌘⇧P** (macOS), type **Cloude Code ToolBox**, run any listed command (that wakes the extension UI), or run **Developer: Reload Window**, then repeat steps 2–4.

![Activity Bar → Cloude Code ToolBox; Side Bar → MCP & skills hub](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/00-toolbox-access.png)

## One place for Claude Code-related setup

**In plain terms:** Claude Code only works as well as the setup around it—but that setup is usually scattered across files, machines, and habits. **Cloude Code ToolBox** is **one dedicated toolbox in VS Code** (and a **preview [JetBrains plugin](packages/cloude-code-toolbox-intellij/README.md)** with ongoing hub parity): you can **see** what’s configured, **standardize** how teams adopt Claude Code (including from **Cursor** and optional **GitHub Copilot → Claude Code** migration), and **give Claude Code better context** while each developer still **chooses** what to share.

**For engineering teams, that means:**

- **Faster path from Cursor (and optional Copilot) to Claude Code** — guided actions to port MCP, sync rules into **`CLAUDE.md`**, scaffold **`memory-bank/`**, and migrate skills.
- **Discover and add servers and skills from one hub** — browse catalogs, see what’s already installed, fewer raw config edits.
- **A single checklist view** — workspace vs personal setup, local skill folders, rules, **`CLAUDE.md`**, legacy Copilot instructions if present, and memory bank so the repo matches what you think you shipped.
- **Smarter context for Claude Code** — structured context packs and readiness flows, with **explicit** choices so teams stay aligned on what the model is allowed to see.

---

## One Click Setup and Thinking Machine Mode

These are the two **highlighted cards** at the top of the hub’s **Intelligence** tab (after **Cloude Code ToolBox** → **MCP & skills**).

### One Click Setup

**What it does:** After you accept the responsibility warning, it runs the automated sequence you configured under **Settings → Cloude Code ToolBox → One Click Setup** (migration tracks: **Cursor → Claude Code** and optional **GitHub Copilot → Claude Code**, each toggled separately). That usually includes **porting Cursor MCP** into VS Code `mcp.json`, **Claude-oriented memory bank** init, **Cursor rules → `CLAUDE.md`**, optional merge of **`.github/copilot-instructions.md`** into **`CLAUDE.md`**, optional **Copilot skills → `.agents`**, optional **`.cursorrules`** merge, **skills** `.cursor` → `.agents` migration, **MCP & Skills awareness** (under **`.claude/`**) with optional block in **`CLAUDE.md`**, **readiness** summary, **Claude Code / MCP config scan**, optional **Claude Code** settings check, and optional **auto-scan** enablement. Bridge steps run via **bundled `node …/cli.mjs`** inside the extension (no `npx` network fetch for that path).

**Why it matters:** “Make this repo Claude-ready” shouldn’t depend on who read which doc. One Click encodes your team’s playbook once; anyone can run the same steps and review the same terminals and file changes.

### Thinking Machine Mode

**What it does:** A **master switch** for **session priming**: optional MCP & Skills awareness (writes under `.claude/`) plus a **context pack** for Claude Code, with separate settings for confirmations and pack defaults. The first time you turn it **on**, VS Code shows **Engage** (sci-fi confirmation); **Cancel** turns the mode off. **Unchecking** the mode clears the acknowledgment so **Engage** appears again next time you enable it. You can also **prime** from the Command Palette when the mode is on.

**Why it matters:** Claude Code is only as good as the **context you give it**. Thinking Machine Mode makes “refresh what this repo knows about MCP, skills, and workspace shape” a **deliberate, repeatable** action instead of an ad-hoc copy-paste.

---

## Table of contents

- [IDE support](#ide-support)
- [After install: open Cloude Code ToolBox (VS Code)](#after-install-open-cloude-code-toolbox-vs-code)
- [One place for Claude Code-related setup](#one-place-for-claude-code-related-setup)
- [One Click Setup and Thinking Machine Mode](#one-click-setup-and-thinking-machine-mode)
- [What’s in this repo](#whats-in-this-repo)
- [See the real UI (screenshots)](#see-the-real-ui-screenshots)
- [MCP & skills hub: every tab, toggle, and button](#mcp--skills-hub-every-tab-toggle-and-button)
- [Why it exists](#why-it-exists)
- [Quick start (extension)](#quick-start-extension)
- [Install the extension](#install-the-extension)
- [Companion tools (npm + GitHub)](#companion-tools-npm--github)
- [Repository layout](#repository-layout)
- [Development](#development)
- [CI](#ci)
- [Publishing (VSIX / Marketplace)](#publishing-vsix--marketplace)
- [Configuration & commands](#configuration--commands)
- [Security & privacy](#security--privacy)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)

---

## What’s in this repo

| Deliverable | Purpose |
|-------------|---------|
| **[Cloude Code ToolBox](packages/cloude-code-toolbox/)** | VS Code extension: **MCP & skills** hub, **workspace kit**, **Intelligence** (context packs, readiness, MCP/Skills awareness under `.claude/`, optional **`CLAUDE.md`** merge, auto-scan on folder open, `.cursor`→`.agents` skill migration), **bundled bridge CLIs** and optional **`npx`** from the hub |
| **[cloude-code-toolbox-intellij](packages/cloude-code-toolbox-intellij/)** | **Preview** JetBrains Platform plugin (Tool Window placeholder); full hub features remain VS Code–first for now |
| **[memory-bank/](memory-bank/)** | Optional project memory files for you and Claude Code (not required to build the extension) |
| **[packages/cursor-mcp-vscode-port/](packages/cursor-mcp-vscode-port/)** | Placeholder README for the MCP port CLI layout; the CLI is published separately on npm |

The extension does **not** replace Claude Code or Cursor; it helps you **align configs** and **see** what’s configured (MCP servers, local `SKILL.md` trees, instructions files). Deeper settings, keybindings, and troubleshooting: **[packages/cloude-code-toolbox/README.md](packages/cloude-code-toolbox/README.md)**.

### See the real UI (screenshots)

These are **actual VS Code UI captures** from the extension—what users see on screen. **How to open the hub** (Activity Bar → Cloude Code ToolBox → **MCP & skills**) is at the top: [After install: open Cloude Code ToolBox (VS Code)](#after-install-open-cloude-code-toolbox-vs-code). Most hub shots below are **high-resolution** (~2.5k width) so labels stay readable in README and on the [static site sources in `/docs`](https://github.com/amitchorasiya/Cloude-Code-ToolBox/tree/main/docs) (GitHub Pages from that folder; gallery images load from **`raw.githubusercontent.com`** on `main`, same pattern as [Github-Copilot-ToolBox](https://github.com/amitchorasiya/Github-Copilot-ToolBox)). See [Pages setup](docs/PAGES-SETUP.md) for the public URL and optional custom domain.

**Intelligence** (hub): **Port Cursor → VS Code + Claude Code** (MCP, rules, memory bank), then broader bridges, context pack, readiness, MCP & Skills scan.

![Intelligence: Port Cursor MCP, rules, and memory bank to VS Code + Claude Code](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/02-intelligence-cursor-port.png)

![Intelligence tab: Cursor to VS Code + Claude Code bridges](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/01-intelligence.png)

![Intelligence: context pack and readiness actions](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/02-intelligence-context-readiness.png)

**MCP**: installed workspace/user servers and registry browse.

![MCP: installed workspace servers (Browse / Installed)](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/03-mcp-browse-workspace-servers.png)

![MCP: registry browse & search](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/04-mcp-registry-search.png)

**Skills**: catalog (skills.sh) and local installed `SKILL.md` trees.

![Skills: catalog (skills.sh)](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/05-skills-catalog-skills-sh.png)

![Skills: installed local skill folders](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/06-skills-installed-local.png)

**Workspace** checklist and **Intelligence** hub (context hygiene).

![Workspace kit checklist](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/07-workspace-checklist.png)

![Intelligence: context hygiene, snapshot, and quick actions](https://raw.githubusercontent.com/amitchorasiya/Cloude-Code-ToolBox/main/screenshots/08-workspace-toolbox-commands.png)

**Reference diagram:** there is no exported PNG in `screenshots/` right now. Regenerate from [`diagrams/mermaid-copilot-map.mmd`](diagrams/mermaid-copilot-map.mmd) with the Mermaid CLI (or any local exporter) and save as `screenshots/mermaid-claude-map.png` if you want this image back in the README.

---

## MCP & skills hub: every tab, toggle, and button

Open the **MCP & skills** hub from the **Side Bar** after you click **Cloude Code ToolBox** in the **Activity Bar** (see [After install: open Cloude Code ToolBox (VS Code)](#after-install-open-cloude-code-toolbox-vs-code) at the top of this README). The hub is organized into **tabs**, a **Browse / Installed** switch (where applicable), a **search** field, optional **MCP chips**, and a **footer** legend.

### Main tabs (top)

| Tab | Purpose |
|-----|---------|
| **Intelligence** | Bridges (**Cursor → Claude Code**; optional **GitHub Copilot → Claude Code**), **Context hygiene** tiles, **Context & readiness** actions, plus auto-scan controls. Default tab. |
| **MCP** | **Browse** official registry search or **Installed** workspace + user servers from `mcp.json`. |
| **Skills** | **Browse** [skills.sh](https://skills.sh) catalog or **Installed** local folders that contain `SKILL.md` under standard roots. |
| **Workspace** | **Workspace checklist** (One Click Setup, rules, memory bank, **`CLAUDE.md`**, `mcp.json`) and **All toolbox commands** (searchable tiles). |

### Browse vs Installed (MCP and Skills only)

| Sub-tab | Purpose |
|---------|---------|
| **Browse** | Search remote catalog (MCP registry or skills.sh). Extra **chip** row appears on **MCP → Browse**. |
| **Installed** | Filter and manage what is already on this machine / in this workspace (`mcp.json` servers or discovered skill folders). |

### One Click Setup card (Intelligence tab, top)

| Control | What it does |
|---------|----------------|
| **One Click Setup** (pill-shaped primary button) | Modal: you accept responsibility for all changes. Then runs the configured automated flow using **bundled Node CLIs** (no `npx`). See **Settings → One Click Setup**. |
| **⚙** | Opens **Settings** filtered to **`cloude-code-toolbox.oneClickSetup`**. |

### Thinking Machine Mode card (Intelligence tab, top)

| Control | What it does |
|---------|----------------|
| **Checkbox** | Toggles **`cloude-code-toolbox.thinkingMachineMode.enabled`** (Workspace when a folder is open, else User). First enable per cycle shows **Engage**; unchecking clears acknowledgment so **Engage** can appear again. |
| **⚙** | Opens **Settings** filtered to **`cloude-code-toolbox.thinkingMachineMode`**. |

### Background MCP & Skills auto-scan (Intelligence tab, bottom bar)

| Control | What it does |
|---------|----------------|
| **Checkbox** (long label about workspace open) | Toggles **`cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen`**. When on: after a workspace opens (debounced), writes **MCP & Skills awareness** under `.claude/`, refreshes the hub, and updates the replaceable MCP/skills block in **`CLAUDE.md`**. Persists to **Workspace** when a folder is open, otherwise **User**. |
| **Scan now** | Runs the awareness flow immediately and refreshes the hub. |

### Search box

Hidden on **Intelligence**. On other tabs it filters: **registry / skills.sh results** (Browse), **installed MCP servers or skills** (Installed), or **toolbox command tiles** (Workspace).

### MCP chip row (MCP → Browse only)

| Chip | What it does |
|------|----------------|
| **Registry** | Opens VS Code’s native MCP registry UI (`workbench.mcp.browseServers`). |
| **Add server** | Opens VS Code’s flow to add MCP configuration (`workbench.mcp.addConfiguration`). |
| **List (native)** | Lists servers in the MCP UI (`workbench.mcp.listServer`). |
| **Port Cursor → VS Code** | Runs the **`cursor-mcp-vscode-port`** `npx` bridge to map Cursor config into VS Code `mcp.json`. |
| **Refresh** | Reloads hub data from disk and config. |

### Intelligence → Context hygiene

| Area | What it does |
|------|----------------|
| **Snapshot** (callout) | Read-only counts: active workspace MCP servers, active user MCP servers, and whether **`CLAUDE.md`** exists (with line count). Clarifies this is file-based, not live Agent runtime. |
| **Scan MCP / instruction files** | Heuristic scan for secret-shaped patterns in `mcp.json` and instruction files; results go to **Output**. |
| **Notepad → memory-bank** | Append **session notepad** content into a **`memory-bank/**/*.md`** file (preview, then write). |
| **New SKILL.md stub** | Creates **`.github/skills/<name>/SKILL.md`** starter. |
| **Verification checklist** | Multi-pick acknowledgement checklist before you ship. |
| **Bundled MCP recipe** | Merges a **sample server** from bundled recipes into **`.vscode/mcp.json`**. |
| **Run first test task** | Runs a **`tasks.json`** task (prefers a test-like name, else the first task). |

### Intelligence → Cursor → VS Code + Claude Code (hero cards)

| Card / button | What it does |
|---------------|----------------|
| **Run npx port** (Port Cursor MCP) | Runs **`CloudeCodeToolBox.portCursorMcp`** → `npx` **cursor-mcp-vscode-port**. |
| **GitHub** (same card) | Opens the port CLI repo in the browser. |
| **Run npx init** (Claude-oriented memory bank) | Runs **`initMemoryBank`** → `npx` **cloude-code-memory-bank** (scaffold `memory-bank/`, merge instructions). |
| **GitHub** | Memory bank repo. |
| **Run converter** (Cursor rules to CLAUDE.md) | Runs **`syncCursorRules`** → `npx` **cursor-rules-to-claude**. |
| **GitHub** | Rules converter repo. |
| **Run migration** (Migrate skills to `.agents`) | Runs **`migrateSkillsCursorToAgents`** — copy/move **`.cursor/skills`** → **`.agents/skills`** (workspace and/or user). |

### Intelligence → Context & readiness (hero cards)

| Button | What it does |
|--------|----------------|
| **Run scan** | **MCP & Skills awareness:** saves **`.claude/cloude-code-toolbox-mcp-skills-awareness.md`**, prompts with **Open report** / shortcuts, and updates the replaceable MCP/skills block in **`CLAUDE.md`** when merge rules apply (interactive hub run, workspace auto-scan, or One Click–forced merge). |
| **Build pack** | **Context pack** quick picks → markdown for Claude Code (files, optional git/diagnostics, etc.). |
| **Run readiness** | Markdown **readiness** summary (instructions, rules, MCP, suggested next steps). |
| **Open settings** | Filtered **Intelligence-related** settings (`cloude-code-toolbox.intelligence.*`). |

### MCP → Browse (registry results)

| Control | What it does |
|---------|----------------|
| **Install** (on a registry card) | Installs that server entry into your MCP config via the extension. |
| **Load more results** | Paginates registry search. |

### MCP → Installed (each server card)

| Button | What it does |
|--------|----------------|
| **Turn OFF** | Removes the server from **`mcp.json`** and **stashes** its JSON in extension storage until you **Turn ON**. |
| **Turn ON** | Restores stashed config into **`mcp.json`**. |
| **Remove** | Deletes stash and/or the **`mcp.json`** entry (after confirmation). |
| **Edit mcp.json** | Opens workspace or user **`mcp.json`** in the editor (native MCP commands). |

### Skills → Browse (skills.sh catalog)

| Button | What it does |
|--------|----------------|
| **Install (project)** | Runs **`npx skills add`** targeting **project** skill roots (per skills.sh flow). |
| **Install (global)** | Same for **user** skill roots. |

### Skills → Installed (each skill card)

| Button | What it does |
|--------|----------------|
| **Turn OFF** | Hides that skill in the hub only (extension state); **folder stays on disk**. |
| **Turn ON** | Shows it again in the hub. |
| **Delete…** | Moves the skill folder to **trash** if it lives under a **known** skill root (confirmation). |
| **Open SKILL.md** | Opens the skill’s **`SKILL.md`**. |
| **Reveal folder** | Reveals the skill folder in the OS file explorer / sidebar. |

### Workspace → Workspace checklist (each row)

| Button | What it does |
|--------|----------------|
| **One Click Setup** | **`runOneClickSetup`** — configurable automated flow (legacy **`workspaceSetupWizard`** opens the same with a short explanation). |
| **Open** | Opens the target file or folder when it already exists. |
| **Create / sync** | Runs the associated command to create or sync that artifact when missing. |

### Workspace → All toolbox commands (grouped tiles)

Use the **search** box to filter. Each **tile** runs one command (same as Command Palette). Groups and actions:

**Intelligence:** Build context pack · Readiness summary · Intelligence settings · MCP port repo (GitHub) · Memory bank repo (GitHub) · Rules converter repo (GitHub) · Migrate skills `.cursor` → `.agents` · Scan MCP & Skills awareness · MCP / instruction config scan · Append notepad → memory-bank · Create SKILL.md stub · Verification checklist · Apply bundled MCP recipe · Run first test task.

**Chat & session:** Open Claude Code · Session notepad · Copy notepad · Composer tips hub · Inline chat (Cursor-style).

**Rules & instructions:** Cursor vs Claude Code reference · Translate @-mentions · Append `.cursorrules` · Open instruction file… · Create `.cursorrules` template · Sync Cursor rules → CLAUDE.md.

**MCP & Cursor bridges:** Open workspace `mcp.json` · Open user `mcp.json` · Toggle MCP discovery · Add server (native).

**Workspace setup:** One Click Setup · Init memory bank.

**Docs & environment:** Claude Code account / pricing · Environment sync checklist.

### Footer (hub)

Summarizes **skill search roots**, **Turn OFF/ON/Delete** behavior for skills, and **Turn OFF/Remove** behavior for MCP—so expectations are explicit without opening docs.

### Sidebar: view title actions

The **MCP & skills** and **Workspace kit** views expose a **Refresh** action in the view title to reload lists and webview state.

---

## Why it exists

- **Different formats:** Cursor uses `~/.cursor/mcp.json` and `mcpServers`; **VS Code** expects workspace/user **`mcp.json`** with a **`servers`** object and **`stdio`** / **`http`** types (used by VS Code MCP and related tooling, including Claude Code workflows in the editor).
- **Different “skills” story:** Local `SKILL.md` folders are useful for humans and for tools that read them; **Claude Code does not automatically load** arbitrary skill folders—the extension lists them for **browse / open** and documents that in the UI.
- **One sidebar:** Open workspace and user MCP, run port/sync/memory-bank CLIs, and run Intelligence flows without hunting commands.

---

## Quick start (extension)

```bash
git clone https://github.com/amitchorasiya/Cloude-Code-ToolBox.git
cd Cloude-Code-ToolBox/packages/cloude-code-toolbox
npm install
npm run compile
```

From the **monorepo root** (after dependencies are installed under the package above):

```bash
npm run compile    # same as npm run compile --prefix packages/cloude-code-toolbox
npm test
```

**Run in VS Code:** open this repository → **Run and Debug** → **Run Extension: Cloude Code ToolBox** (see [`.vscode/launch.json`](.vscode/launch.json)).

---

## Install the extension

- **Marketplace:** search for **Cloude Code ToolBox (MCP, Skills, Cursor/Copilot → Claude)** (the public listing name) or install by id:  
  `code --install-extension amitchorasiya.cloude-code-toolbox-vscode`
- **In VS Code after install:** the **Activity Bar** and commands still show **Cloude Code ToolBox** (short UI label).
- **From VSIX:** build with `npm run package` inside `packages/cloude-code-toolbox/`, then **Install from VSIX…** in VS Code.

**If you had the old Marketplace id `amitchorasiya.cloude-code-toolbox`:** that slug is **permanently reserved** after the listing was removed; this repo now publishes as **`amitchorasiya.cloude-code-toolbox-vscode`** (install the new id above—your **settings** under `cloude-code-toolbox.*` are unchanged).

**Requirements:** VS Code **1.99+**, **Claude Code** extension, **Node.js 20+** for bundled CLIs and optional `npx` bridges. **Git** on `PATH` for optional Intelligence “include git” (Windows: [Git for Windows](https://git-scm.com/download/win)).

---

## Companion tools (npm + GitHub)

These work alongside the extension; the **Intelligence** hub links to their repos and can run several via `npx`.

| npm package | Role | GitHub |
|-------------|------|--------|
| `cursor-mcp-vscode-port` | Port Cursor `mcp.json` → VS Code `mcp.json` | [Cloude-Code-ToolBox](https://github.com/amitchorasiya/Cloude-Code-ToolBox) |
| `cloude-code-memory-bank` | Scaffold `memory-bank/` + merge into `CLAUDE.md` | [Cloude-Code-ToolBox](https://github.com/amitchorasiya/Cloude-Code-ToolBox) |
| `cursor-rules-to-claude` | Generate `CLAUDE.md` + `.claude/rules` from `.cursor/rules` | [Cloude-Code-ToolBox](https://github.com/amitchorasiya/Cloude-Code-ToolBox) |

---

## Repository layout

```
.
├── LICENSE                          # MIT (applies to repo contents; see package LICENSEs)
├── README.md                        # This file
├── package.json                     # Private monorepo helper scripts (compile / test / package:extension / rebuild:extensions)
├── scripts/
│   └── rebuild-extensions.sh        # One-shot: VSIX + IntelliJ ZIP (see npm run rebuild:extensions)
├── packages/
│   ├── cloude-code-toolbox/         # VS Code extension — publish VSIX / Marketplace from HERE
│   │   ├── LICENSE                  # MIT (bundled in .vsix)
│   │   ├── package.json
│   │   ├── src/
│   │   └── README.md
│   ├── cloude-code-toolbox-intellij/  # JetBrains plugin (preview) — Gradle; ./gradlew buildPlugin → ZIP under build/distributions/
│   ├── cursor-mcp-vscode-port/      # Vendored MCP port CLI (`npx` name: cursor-mcp-vscode-port)
│   ├── cursor-mcp-to-github-copilot-port/  # Legacy folder name only; use cursor-mcp-vscode-port
│   ├── cloude-code-memory-bank/     # Vendored memory-bank + `CLAUDE.md` merge CLI
│   └── cursor-rules-to-claude/      # Vendored Cursor rules → `CLAUDE.md` CLI
├── memory-bank/                     # Project docs for agents / Claude Code
├── docs/                            # Static landing site for GitHub Pages (`npm run serve:site`)
├── screenshots/                     # README and docs: UI captures (`00-toolbox-access` … `08-…`; diagram export optional)
└── .github/workflows/               # extension-ci.yml → multi-OS build + tests
```

---

## Development

1. `cd packages/cloude-code-toolbox && npm install`
2. `npm run compile` — TypeScript → `out/`
3. `npm test` — Vitest (unit tests for Intelligence helpers, skills, etc.)
4. F5 — extension host

**Rebuild both artifacts (`.vsix` + IntelliJ `.zip`):** from the monorepo root, `npm run rebuild:extensions` (runs [scripts/rebuild-extensions.sh](scripts/rebuild-extensions.sh): compile, tests, export hub HTML for IntelliJ, `npm run package`, `npm run package:intellij`). Set `REBUILD_SKIP_TESTS=1` for a faster run without Vitest.

**Tech stack (extension):** TypeScript, VS Code API `^1.99`, Vitest. See [packages/cloude-code-toolbox/README.md](packages/cloude-code-toolbox/README.md) for settings, keybindings, and caveats (`#file:` vs Add context, etc.).

---

## CI

- **VS Code extension:** [`.github/workflows/extension-ci.yml`](.github/workflows/extension-ci.yml) — triggers on `packages/cloude-code-toolbox/**`, root `package.json`, or that workflow file.
- **IntelliJ plugin (preview):** [`.github/workflows/intellij-ci.yml`](.github/workflows/intellij-ci.yml) — triggers on `packages/cloude-code-toolbox-intellij/**` or that workflow file; runs `./gradlew buildPlugin` on Ubuntu with JDK 21.
- **Matrix:** Ubuntu, Windows, macOS — `npm install`, `npm run compile`, `npm test`, verifies `out/extension.js` exists.

---

## Publishing (VSIX / Marketplace)

Always use **`packages/cloude-code-toolbox/`** as the extension root (matches `repository.directory` in that `package.json`).

```bash
cd packages/cloude-code-toolbox
npm install
npm run compile
npm run package          # stages monorepo README (+ screenshot URLs) for Marketplace, then vsce package
# npx vsce publish       # when you are logged in to the publisher (from this directory)
```

The `.vsix` **README** is the **monorepo root** [`README.md`](README.md) (same content as on GitHub). Screenshot images use absolute **`raw.githubusercontent.com/.../main/screenshots/…`** URLs so they render on GitHub, the Marketplace, and anywhere else the README is shown; **`npm run package`** appends a cache-busting **`?v=`** (from the extension version) to those image URLs for the packed `.vsix`. Other relative repo links in the staged README are turned into absolute GitHub URLs before packaging. [`packages/cloude-code-toolbox/README.md`](packages/cloude-code-toolbox/README.md) is restored after each package run. Do not use **`package:extension-readme-only`** for a real publish—that skips this flow and README images break.

From monorepo root: `npm run package:extension` (after `npm install` in the package directory).

The **`LICENSE`** file in `packages/cloude-code-toolbox/` is included in the VSIX for Marketplace compliance.

---

## Configuration & commands

**Commands** use **`CloudeCodeToolBox.*`**. **Settings** use **`cloude-code-toolbox.*`** (stable namespace in VS Code Settings). On first load after upgrade, legacy **`CloudeCodeToolBox.*`** setting values migrate into **`cloude-code-toolbox.*`**.

Notable settings (see [extension README](packages/cloude-code-toolbox/README.md#settings) for a concise table):

- `cloude-code-toolbox.npxTag`, **`embeddedBridgeNodeExecutable`**, `useInsidersPaths`
- `cloude-code-toolbox.intelligence.*` (context pack defaults, **auto-scan MCP & Skills on workspace open**, session notepad / open Claude Code after pack, etc.)
- `cloude-code-toolbox.oneClickSetup.*` (**One Click Setup** — includes **Migration tracks** `migrateFromCursor` / `migrateFromGitHubCopilot`, plus Memory Bank, Rules, Skills, MCP, Follow-ups, and optional Copilot instruction/skills merge settings)
- `cloude-code-toolbox.thinkingMachineMode.*` (**Engage** dialog, priming, awareness, context pack when the mode is on)
- `cloude-code-toolbox.translateWrapMultilineInFence`

**Open filtered settings from the Command Palette** (titles match VS Code exactly):

- **Cloude Code ToolBox: Thinking Machine Mode — open related settings** → `cloude-code-toolbox.intelligence`
- **Cloude Code ToolBox: Thinking Machine Mode — open Thinking Machine settings** → `cloude-code-toolbox.thinkingMachineMode`
- **Cloude Code ToolBox: Thinking Machine Mode — open One Click Setup settings** → `cloude-code-toolbox.oneClickSetup`

You can also search **`cloude-code-toolbox`** in the Settings UI. **Note:** Many toolbox commands are grouped under the **Thinking Machine Mode —** prefix in the palette even when they are general Intelligence actions—search **Cloude Code ToolBox** to see the full list.

---

## Security & privacy

- **MCP configs** may contain paths, env vars, or secrets. Treat `mcp.json` as sensitive; do not commit secrets.
- The extension **starts terminals** for **`npx`** and **bundled Node** bridges, edits **`mcp.json`**, **`CLAUDE.md`**, **`.claude/`**, and related paths, and may **spawn `git`** for optional Intelligence sections—only run servers and commands you trust.
- **skills.sh** / registry features call **public HTTP APIs**; review network use in corporate environments.

---

## Contributing

Issues and PRs are welcome. Please:

- Run `npm run compile` and `npm test` under `packages/cloude-code-toolbox/` before submitting.
- Keep changes focused; match existing TypeScript and doc style.

---

## License

This repository is released under the **MIT License**. See [LICENSE](LICENSE). The VS Code extension package includes its own [packages/cloude-code-toolbox/LICENSE](packages/cloude-code-toolbox/LICENSE) for distribution in `.vsix`.

---

## Disclaimer

**Independence and trademarks.** This monorepo is **independent** community tooling. It is **not** affiliated with, endorsed by, sponsored by, or maintained by Microsoft, GitHub, Cursor, OpenAI, Anthropic, or other vendors of products named in this documentation. The **Cloude Code ToolBox** name is an **independent project brand** and is **not** the Anthropic **Claude** product or service. **Visual Studio**, **Visual Studio Code**, **GitHub**, **Cursor**, **Anthropic**, **Claude**, and other product names may be **trademarks** of their respective owners. For Microsoft’s naming and branding expectations around VS Code, see the official [Visual Studio Code brand guidelines](https://code.visualstudio.com/brand). Third-party workflow inspiration is credited in [`packages/cloude-code-toolbox/NOTICE`](packages/cloude-code-toolbox/NOTICE).

**Software warranty.** Code is released under the [MIT License](LICENSE). The license applies **“AS IS”**, without warranties of any kind, and limits liability—read the full license text shipped with the software.

**No professional services.** Documentation and the extension are **not** security audits, legal review, or architecture sign-off. Your team remains responsible for MCP servers, skills, credentials, `npx` packages, and what you send to AI features.

**Third parties.** The extension can run **`npx`** bridges, open registry or catalog UIs, and edit local config files. **npm packages**, **MCP servers**, **catalogs**, and **editor or Claude Code features** are third-party; this project does **not** control their behavior, availability, or terms. Evaluate them before you install, connect, or execute them.

**Your data and configs.** You are responsible for backups, secrets hygiene, and compliance with your employer’s and vendors’ policies when using AI tooling and automation.
