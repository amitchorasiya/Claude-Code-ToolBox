# Claude Code ToolBox (VS Code extension)

## Packaging note

`npm run package` in this folder **stages** the [monorepo root `README.md`](../../README.md) into this file for the `.vsix` / Marketplace: screenshot links become absolute **`raw.githubusercontent.com/.../main/screenshots/…`** URLs (with `?v=` cache-bust from `package.json` version), matching [Github-Copilot-ToolBox](https://github.com/amitchorasiya/Github-Copilot-ToolBox). It then **restores** this extension reference README. Avoid **`package:extension-readme-only`** for publishing—that skips the staging step and README images break.

**Identity:** **Marketplace ID** `amitchorasiya.claude-code-toolbox-vscode` · **`displayName`** **Claude Code ToolBox (MCP, Skills, Cursor/Copilot → Claude)** · **`package.json` name** `claude-code-toolbox-vscode` (the slug `claude-code-toolbox` stays **permanently reserved** by the Marketplace after a removed listing—pick a new name to publish again) · **Monorepo** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox) · this folder is `packages/claude-code-toolbox/`.

**JetBrains:** **IntelliJ Platform** plugin (preview) — [`packages/claude-code-toolbox-intellij/`](../claude-code-toolbox-intellij/README.md) · [Marketplace search](https://plugins.jetbrains.com/search?search=Cloude+Code+ToolBox) · [`jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox). **VS Code:** [Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) · [`vscode:extension/amitchorasiya.claude-code-toolbox-vscode`](vscode:extension/amitchorasiya.claude-code-toolbox-vscode).

---

## After install: open Claude Code ToolBox

**Not a standalone app**—only inside **Visual Studio Code**.

1. Install **Claude Code ToolBox**, then **reload the window** if prompted.
2. **Activity Bar** (icons on the **far left**) → click **Claude Code ToolBox**.
3. **Side Bar** → **MCP & skills** to open the **hub** (tabs: **Intelligence**, **MCP**, **Skills**, **Workspace**).

**Missing the icon?** **Command Palette** (**Ctrl+Shift+P** / **⌘⇧P**) → type **Claude Code ToolBox** → run a command, or **Developer: Reload Window**, then repeat steps 2–3.

![Activity Bar → Claude Code ToolBox; Side Bar → MCP & skills hub](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/00-toolbox-access.png?v=1.0.9)

---

## One place for Claude Code-related setup

**In plain terms:** Claude Code in VS Code only works as well as the setup around it—but that setup is usually scattered across files, machines, and habits. **Claude Code ToolBox** is **one dedicated toolbox in VS Code**: you can **see** what’s configured, **standardize** how teams adopt **Claude Code** (including migrations from **Cursor** and optional steps from **GitHub Copilot**), and **build explicit context** while each developer still **chooses** what to share.

**One Click Setup** (hub → **Intelligence**, top card) runs your configured **migration tracks** and follow-ups using **bundled Node CLIs** (no `npx` fetch) after you confirm the risk modal. **Thinking Machine Mode** is the master switch for **session priming** (MCP & skills awareness under `.claude/` plus optional merge into **`CLAUDE.md`**, and a **context pack** for Claude Code). First enable shows **Engage**; turning the mode off clears acknowledgment so **Engage** can run again next time.

For a **full control-by-control** hub reference (every tab, chip, and tile), see the [monorepo README — MCP & skills hub](https://github.com/amitchorasiya/Claude-Code-ToolBox/blob/main/README.md#mcp--skills-hub-every-tab-toggle-and-button).

---

## Table of contents

- [After install: open Claude Code ToolBox](#after-install-open-claude-code-toolbox)
- [One place for Claude Code-related setup](#one-place-for-claude-code-related-setup)
- [Overview](#overview)
- [Screenshots](#screenshots)
- [Hub summary](#hub-summary)
- [Requirements](#requirements)
- [Features (at a glance)](#features-at-a-glance)
- [Command palette](#command-palette)
- [Settings](#settings)
- [Keybinding](#keybinding)
- [Companion npm packages](#companion-npm-packages)
- [Develop & test](#develop--test)
- [Troubleshooting](#troubleshooting)
- [Publishing](#publishing)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Overview

**Claude Code ToolBox** adds:

1. **MCP & skills** — Webview hub: **Intelligence** (default), **MCP**, **Skills**, **Workspace** (checklist + searchable command tiles).
2. **Workspace kit** — Tree checklist for rules, memory bank, **`CLAUDE.md`**, `mcp.json`, plus **One Click Setup** (top row).
3. **Session notepad** — Optional scratch file at **`.vscode/claude-code-toolbox-notepad.md`** (open/copy from the hub tiles or Command Palette); context packs can append here.

**Commands:** `CloudeCodeToolBox.*`. **Settings:** `claude-code-toolbox.*` (legacy `CloudeCodeToolBox.*` values migrate on load).

In this repo, the extension reference README keeps **absolute** `raw.githubusercontent.com` URLs for screenshots. **`npm run package`** temporarily replaces this file with the transformed monorepo README (same raw URLs + `?v=`) for the `.vsix`, then restores this file.

---

## Screenshots

Real VS Code UI (not mockups). **Opening the hub:** [After install](#after-install-open-claude-code-toolbox). Captures are high-resolution where noted.

**Intelligence:** Cursor → VS Code + Claude Code bridges, context pack, readiness, MCP & Skills awareness.

![Intelligence: Port Cursor MCP, rules, and memory bank to VS Code + Claude Code](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/02-intelligence-cursor-port.png?v=1.0.9)

![Intelligence tab: Cursor to VS Code + Claude Code bridges](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/01-intelligence.png?v=1.0.9)

![Intelligence: context pack and readiness actions](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/02-intelligence-context-readiness.png?v=1.0.9)

**MCP** and **Skills** tabs: installed servers, registry browse, skills.sh, local `SKILL.md` trees.

![MCP: installed workspace servers](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/03-mcp-browse-workspace-servers.png?v=1.0.9)

![MCP: registry browse & search](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/04-mcp-registry-search.png?v=1.0.9)

![Skills: catalog (skills.sh)](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/05-skills-catalog-skills-sh.png?v=1.0.9)

![Skills: installed local skill folders](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/06-skills-installed-local.png?v=1.0.9)

**Workspace** checklist and **Intelligence** context hygiene.

![Workspace kit checklist](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/07-workspace-checklist.png?v=1.0.9)

![Intelligence: context hygiene and quick actions](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/08-workspace-toolbox-commands.png?v=1.0.9)

**Reference diagram:** no PNG ships in `screenshots/` for the capability map right now. Source: [`diagrams/mermaid-copilot-map.mmd`](https://github.com/amitchorasiya/Claude-Code-ToolBox/blob/main/diagrams/mermaid-copilot-map.mmd) — export to PNG and add `screenshots/mermaid-claude-map.png` if you want an embedded diagram here again.

---

## Hub summary

Open **MCP & skills** from the **Side Bar** after selecting **Claude Code ToolBox** in the **Activity Bar**.

| Tab | Role |
|-----|------|
| **Intelligence** | Migration hero cards (Cursor → Claude Code; optional GitHub Copilot → Claude Code), **One Click Setup**, **Thinking Machine Mode**, context hygiene, context & readiness, **auto-scan** row (writes **`.claude/claude-code-toolbox-mcp-skills-awareness.md`**, optional MCP/skills block in **`CLAUDE.md`**). |
| **MCP** | **Browse** registry / **Installed** workspace + user `mcp.json`. |
| **Skills** | **Browse** skills.sh / **Installed** local skills. |
| **Workspace** | Checklist + **All toolbox commands** tiles. |

**Auto-scan:** When `claude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen` is on, a debounced run after folder open refreshes awareness and updates the replaceable MCP/skills section in **`CLAUDE.md`** (and saves the full report under `.claude/`).

---

## Requirements

| Requirement | Notes |
|-------------|--------|
| VS Code | **1.99+** |
| Claude Code | Install the **Claude Code** extension for flows that open or target Claude Code. |
| Node.js | **20+** for bundled CLIs and optional `npx` bridges (`package.json` engines). |
| Git | On `PATH` for optional Intelligence “include git” (Windows: [Git for Windows](https://git-scm.com/download/win)). |

---

## Features (at a glance)

- **One hub** for MCP + skills: workspace/user **`mcp.json`**, registry and skills.sh browse, stash/hide semantics for servers and skills.
- **Intelligence:** Awareness report, **context pack**, **readiness**, **Claude Code / MCP config scan**, notepad → memory-bank, bundled MCP recipes, verification checklist.
- **Bridges:** Port Cursor MCP, init **cloude-code-memory-bank**, **cursor-rules-to-claude**, migrate **`.cursor/skills`** → **`.agents/skills`**, optional **GitHub Copilot** instructions/skills → Claude-oriented files (One Click **migration tracks**).
- **Bundled CLIs** for One Click and “without npx” commands; primary hub actions avoid a network `npx` fetch when using bundled paths.
- **Honest skills story:** Local **`SKILL.md`** trees are listed for humans and tools; Claude Code does not auto-load arbitrary folders—use instructions, attachments, or MCP as appropriate.

---

## Command palette

Commands are titled **`Claude Code ToolBox: …`**. Many Intelligence and setup actions use the **`Thinking Machine Mode —`** prefix in the palette (historical grouping)—search **`Claude Code ToolBox`** to see everything, not only Thinking Machine–specific commands.

Examples:

- `Claude Code ToolBox: Thinking Machine Mode — One Click Setup (configured steps)`
- `Claude Code ToolBox: Port Cursor MCP → VS Code (bundled CLI — no npx)`
- `Claude Code ToolBox: Sync Cursor rules → CLAUDE.md (npx)`
- `Claude Code ToolBox: Open Claude Code`
- `Claude Code ToolBox: Open workspace mcp.json` / `Open user mcp.json`

Search **Claude Code ToolBox** under **Keyboard Shortcuts** to rebind.

---

## Settings

| Setting | Purpose |
|---------|---------|
| `claude-code-toolbox.npxTag` | Dist-tag or version for optional `npx` runs (default `latest`) |
| `claude-code-toolbox.embeddedBridgeNodeExecutable` | Optional absolute path to `node` for bundled CLIs |
| `claude-code-toolbox.useInsidersPaths` | Resolve user `mcp.json` under VS Code Insiders |
| `claude-code-toolbox.intelligence.*` | Context pack defaults, **auto-scan MCP & Skills on workspace open**, notepad/chat follow-ups |
| `claude-code-toolbox.oneClickSetup.*` | **Migration tracks** (`migrateFromCursor`, `migrateFromGitHubCopilot`), memory bank / rules / skills / MCP / follow-ups, optional **merge Copilot instructions** and **Copilot skills** migration |
| `claude-code-toolbox.thinkingMachineMode.*` | Priming, awareness, context pack, **Engage** behavior |
| `claude-code-toolbox.translateWrapMultilineInFence` | Translation helper |

**Open filtered settings** (exact palette titles):

- **Claude Code ToolBox: Thinking Machine Mode — open related settings** → `claude-code-toolbox.intelligence`
- **Claude Code ToolBox: Thinking Machine Mode — open Thinking Machine settings** → `claude-code-toolbox.thinkingMachineMode`
- **Claude Code ToolBox: Thinking Machine Mode — open One Click Setup settings** → `claude-code-toolbox.oneClickSetup`

Or search **`claude-code-toolbox`** in the Settings UI.

---

## Keybinding

- **Ctrl+Alt+K** (Windows/Linux) / **Cmd+Alt+K** (macOS) → **Open inline chat (Cursor-style)**  
  Avoid binding over VS Code’s global **Ctrl+K** chord.

---

## Companion npm packages

Vendored beside the extension; published names:

| Package | Role |
|---------|------|
| `cursor-mcp-vscode-port` | Cursor `mcp.json` → VS Code `mcp.json` |
| `cloude-code-memory-bank` | Scaffold `memory-bank/` + merge into `CLAUDE.md` |
| `cursor-rules-to-claude` | Cursor rules → `CLAUDE.md` / `.claude/rules` |

Repos: [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox).

---

## Develop & test

```bash
cd packages/claude-code-toolbox   # from monorepo root
npm install
npm run compile
npm test
```

- **CI:** `.github/workflows/extension-ci.yml` (Ubuntu, Windows, macOS). IntelliJ: `.github/workflows/intellij-ci.yml`.
- **F5:** **Run Extension: Claude Code ToolBox** (`extensionDevelopmentPath` = this folder).

**Context pack caveat:** Pasted `#file:` lines may not attach like native **Add context**; prefer explicit paths and small selections when priming Claude Code.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| MCP UI differs by VS Code version | Update VS Code; use native **MCP** commands where listed. |
| Port / `npx` fails | Install **Node 20+**, check network; pin `claude-code-toolbox.npxTag` if needed; use **bundled CLI — no npx** commands. |
| No skills listed | Ensure a **subfolder** under a scanned root contains **`SKILL.md`**. |
| Claude Code “ignores” skills | Expected for arbitrary trees—use **`CLAUDE.md`**, awareness under `.claude/`, attachments, or MCP. |
| Insiders vs stable user MCP | Toggle `claude-code-toolbox.useInsidersPaths`. |
| Auto-scan on every open | Disable `claude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen` or uncheck the hub row. |

---

## Publishing

```bash
npm run compile
npm run package    # vsce → .vsix (see monorepo README for README staging)
```

[LICENSE](LICENSE) ships in the `.vsix`. Full notes: [monorepo README — Publishing](https://github.com/amitchorasiya/Claude-Code-ToolBox/blob/main/README.md#publishing-vsix--marketplace).

---

## Contributing

PRs welcome. From this package: run **`npm run compile`** and **`npm test`** before submitting. Prefer focused changes; match existing TypeScript style. See the [monorepo README — Contributing](https://github.com/amitchorasiya/Claude-Code-ToolBox/blob/main/README.md#contributing) for repo-wide expectations.

---

## Disclaimer

**Independence and trademarks.** **Claude Code ToolBox** is **independent** community tooling. It is **not** affiliated with, endorsed by, sponsored by, or maintained by Microsoft, GitHub, Cursor, OpenAI, Anthropic, or other vendors named in this README. Product names may be **trademarks** of their respective owners. For Microsoft’s VS Code branding expectations, see [Visual Studio Code brand guidelines](https://code.visualstudio.com/brand).

**MIT “AS IS”.** Licensed under the [MIT License](LICENSE).

**Not professional services.** Not a security audit or legal review.

**Third parties.** The extension can run **`npx`**, bundled **Node** CLIs, open registries, and edit **`mcp.json`**, **`CLAUDE.md`**, and **`.claude/`** files. Evaluate npm packages, MCP servers, and AI products before use.

**Your responsibility.** Backups, secrets hygiene, and policy compliance are yours.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 amitchorasiya.
