# Changelog

## 1.0.9

- **Docs:** Root README, extension README, IntelliJ README, and GitHub Pages (`docs/index.html`) now link both the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.cloude-code-toolbox-vscode) and JetBrains plugin install (`jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox` plus Marketplace search fallback).
- Patch release: version **1.0.9** (VS Code) / **0.6.10** (IntelliJ plugin).

## 1.0.8

- **Merge-only defaults:** MCP port, memory bank init, Cursor rules → `CLAUDE.md`, and skills migration no longer replace existing config or whole files without merging; One Click / Settings enums updated accordingly.
- Patch release: version **1.0.8** (VS Code) / **0.6.9** (IntelliJ preview plugin).

## 1.0.7

- Patch release: version bump and docs/cache-bust alignment.

## 1.0.6

- **Marketplace:** **`displayName`** set to **Claude Code ToolBox (MCP, Skills, Cursor/Copilot → Claude)**.
- **Docs / site:** Root README and **GitHub Pages** (`docs/index.html`) now spell out the Marketplace listing title, id, and short VS Code UI label; refreshed page `<title>`, meta description, and CTA copy; `site.css?v=22`.
- **Docs / site:** **Cloude Code** visual theme for GitHub Pages — deep ink base, sky + violet accents (extension-inspired), ember monospace hints; `site.css?v=23`.
- **Docs / site:** **Claude Code–style** marketing theme — `#000` base, terracotta `#d08870`, brown offset block shadows, **Press Start 2P** headlines, DM Sans body; `site.css?v=24`.
- **Docs / site:** **Light (default)** and **Dark** themes on GitHub Pages — header **Light** / **Dark** buttons, `localStorage` key `cloude-docs-theme`, early script to avoid flash; `site.css?v=26`.

## 1.0.5

- **Marketplace:** **`displayName`** set to **Claude Code ToolBox (MCP, skills, Cursor/Copilot→Claude)**.

## 1.0.4

- **Marketplace:** **`displayName`** is **Claude Code ToolBox** again (short title only).

## 1.0.3

- **Marketplace:** Unique **`displayName`**: **Claude Code ToolBox — Claude Code & MCP** (plain **Claude Code ToolBox** was rejected as already taken—often reserved after a removed listing). Activity Bar / hub branding in VS Code is unchanged.

## 1.0.2

- **Marketplace:** Extension **`name`** / id is now **`cloude-code-toolbox-vscode`** (`amitchorasiya.cloude-code-toolbox-vscode`). The previous slug **`cloude-code-toolbox` cannot be reused** after the listing was removed—Marketplace reserves it permanently ([publishing docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#removing-an-extension)). README and site install links updated; settings still use **`cloude-code-toolbox.*`**.

## 1.0.1

- **Marketplace metadata:** Align `package.json` description with **GitHub Copilot Toolbox** (Microsoft/GitHub/Anthropic disclaimer + **NOTICE** attribution). Add **`NOTICE`** beside **LICENSE**. README: drop `github.io` and `mermaid.live` hyperlinks from the packaged overview (use repo `/docs` tree and local Mermaid export only) and clarify that **Claude Code ToolBox** is an independent brand vs Anthropic **Claude**.

## 1.0.0

Stable **1.0** release (version bump from 0.1.0). No functional change from 0.1.0 beyond semver and docs/cache-bust alignment for Marketplace and GitHub Pages screenshots.

## 0.1.0

Initial **Claude Code ToolBox** public version (semver reset). MCP & skills hub, Thinking Machine Mode, dual-track **One Click Setup** (Cursor → Claude Code and GitHub Copilot → Claude Code), bundled bridge CLIs, awareness under `.claude/` and merges into `CLAUDE.md`, Intelligence tiles for Copilot → Claude migration, and Claude Code–oriented readiness and config scan.

---

## 0.5.41 (pre-rename lineage)

- **Thinking Machine Mode:** Turning the mode **on** (hub or Settings), after **Engage** or when already acknowledged, now runs **MCP & Skills awareness** when **During Thinking Machine priming: run MCP & Skills awareness** is on — so `.github/cloude-code-toolbox-mcp-skills-awareness.md` is recreated without relying only on workspace reopen or **Scan now**.

## 0.5.40

- Patch version bump.

## 0.5.39

- **One Click Setup:** MCP port, memory bank init, and Cursor rules → Copilot now use the **bundled CLIs** (`node …/cli.mjs` in the Toolbox terminal), not **npx**. Missing `node_modules` bridges surface as completion notes instead of extra error modals. Hub copy and the confirmation dialog mention bundled / no npx.

## 0.5.38

- **Hub:** One Click Setup is a **single** pill-style primary button (no duplicate label + button). **Intelligence** cards use a **25px spacer** (checkbox column width) so One Click text lines up with Thinking Machine Mode; icon columns are both **46px**; title pills use matching vertical padding.

## 0.5.37

- **Thinking Machine Mode:** Unchecking **Enabled** (hub or Settings) clears the **Engage** acknowledgment so checking it again shows the **initialize neural link?** dialog, not only the first time ever.

## 0.5.36

- **Hub (Intelligence):** **One Click Setup** uses the same kind of highlighted card as Thinking Machine (⚡ + ✨ glyph, pill title, link-tinted border/glow, primary button + settings gear). Tightened spacing below the section tabs and removed the old top rule on that row so it sits closer to the tabs.

## 0.5.35

- **Hub:** Replaced the bottom **Skills / MCP paths** footer with the **background MCP & Skills auto-scan** row (checkbox + **Scan now**); it stays at the foot of the panel on the **Intelligence** tab. One Click + Thinking Machine stay at the top.

## 0.5.34

- **Hub:** Removed the duplicate **Claude cloud agent (Copilot Chat)** callout and hygiene tile from Context hygiene; **Enable Claude agent** / **Claude agent prerequisites** remain under Thinking Machine Mode tiles and the Command Palette.

## 0.5.33

- **Hub:** Thinking Machine Mode card shows a large **🧠** + **⚡** glyph with accent glow and light motion (respects reduced-motion).

## 0.5.32

- **Hub:** **Thinking Machine Mode** block on the Intelligence page uses stronger visual emphasis (accent card, pill title, glow) so it reads as a primary control.

## 0.5.31

- **Hub:** First tab label is **Intelligence** again (only the tab; settings and “Thinking Machine Mode” wording elsewhere unchanged).
- **Thinking Machine Mode:** Turning **Enabled** on (Settings or hub) now sets the other Thinking Machine Mode checkboxes to **on** at the same scope (after **Engage** on first enable).

## 0.5.30

- **Hub:** **Thinking Machine Mode** is a **checkbox** directly under **One Click Setup** (same master switch as settings). Turning it on uses the normal config path so the **Engage** / neural-link modal still runs on first enable; ⚙ opens all Thinking Machine settings.
- **Settings UI:** **Thinking Machine Mode** section moved to **order 155** (below all **One Click Setup** groups, above Legacy). Master switch property uses display **title** “Thinking Machine Mode”.

## 0.5.29

- **Thinking Machine Mode:** New settings section (master switch, priming options, optional separate context-pack defaults) and **Engage** confirmation the first time the mode is enabled (dismiss reverts the toggle). Command Palette: **prime session** (`runThinkingMachinePriming`) and **open Thinking Machine settings**; hub tab renamed from **Intelligence** to **Thinking Machine** with **Prime session** and split settings tiles (Thinking Machine vs context pack defaults).
- **MCP & Skills — background sync:** `cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen` moved to its own settings group at the bottom; default is now **on**. One-time informational toast after upgrade; open **MCP & Skills — background sync** to change it.
- **Palette:** Former **Intelligence —** command titles now use **Thinking Machine Mode —** where applicable.

## 0.5.28

- **Without npx / bundled CLIs:** Stopped using **`process.execPath`** as the interpreter — in VS Code that path is **Code Helper (Plugin)** (Electron), not Node, so running `cli.mjs` caused **`zsh: trace trap`** / crash. Commands now use **`node` from the integrated terminal’s PATH** (same as npx). Optional setting **`cloude-code-toolbox.embeddedBridgeNodeExecutable`** overrides with an absolute path when `node` is not on PATH.

## 0.5.27

- **Without npx / bundled CLIs in the VSIX:** Removed **`node_modules/**`** from `.vscodeignore`. vsce applies ignore rules to **production dependency** file paths too (`node_modules/<pkg>/…`), so that line was excluding the three bridge packages from the published extension — `require.resolve` then failed at runtime. Production `npm list` paths are still the only `node_modules` trees packed (root glob skips nested `node_modules`).
- **Resolution fallback:** Embedded CLI lookup also tries **`extensionPath/node_modules/<name>`** when `createRequire(__filename)` fails.

## 0.5.26

- **Without npx = real bridges:** Hub **Without npx** and matching palette commands now run the same **cursor-mcp-to-github-copilot-port**, **github-copilot-memory-bank**, and **cursor-rules-to-github-copilot** CLIs as **bundled npm dependencies** (`node …/cli.mjs` in the **GitHub Copilot Toolbox** terminal), with the same quick picks as the npx flows — no manual merge or “open README” hand-waving.
- **Hub:** Removed per-bridge **GitHub** buttons from Cursor→VS Code & Copilot hero cards (skills row unchanged). **Toolbox CLI repos** palette/hygiene command unchanged.
- **Dependencies:** Extension ships production `dependencies` for those three packages so the VSIX resolves CLIs at runtime (vsce still installs listed dependencies when packaging).
- **MCP port (npx + bundled):** When **User mcp.json** is chosen, **Port Cursor MCP** now respects **`cloude-code-toolbox.useInsidersPaths`** (`-t insiders` vs `-t user`).

## 0.5.25

- **Intelligence bridge cards:** Third action on each Cursor→Copilot hero — **Without npx** (MCP manual merge, memory bank README + files, rules reveal + instruction picker + Output notes) and **Open folders** for skills (migration already avoids npx). Matching palette commands and **Workspace** tab Intelligence tiles added.

## 0.5.24

- **One Click MCP port default:** `cloude-code-toolbox.oneClickSetup.portCursorMcp` now defaults to **`user`** (write **user mcp.json** for all workspaces) instead of workspace merge. Settings enum order lists **user** first. The **Port Cursor MCP** command quick pick lists **User mcp.json** first for consistency.

## 0.5.23

- **One Click confirmation:** Removed the extra **Cancel** action item — VS Code modal `showWarningMessage` already supplies cancel/dismiss, so listing `"Cancel"` produced two identical buttons.

## 0.5.22

- **Claude cloud agent (Copilot Chat):** New Intelligence hub **callout** (Enable + Prerequisites), hygiene tile, and Command Palette commands to set **github.copilot.chat.claudeAgent.enabled** (User) and show a modal with plan/org/GitHub/VS Code prerequisites (links to [third-party agents](https://code.visualstudio.com/docs/copilot/agents/third-party-agents) docs). **One Click Setup** can run the same toggle via **`cloude-code-toolbox.oneClickSetup.enableClaudeCopilotChatAgent`** (default **on**); the One Click confirmation dialog mentions org Partner Agents and the Cloud → Claude flow.

## 0.5.21

- **One Click defaults (Memory Bank + rules):** Settings UI lists **apply** first for `initMemoryBankMode` and `syncCursorRulesMode` (defaults unchanged: **apply**). Descriptions call out defaults explicitly. **`initMemoryBankCursorRules`** now defaults to **on** (matches `appendCursorrules` default **on**); runtime fallback in One Click updated to **true** when the key is unset.

## 0.5.20

- **Fix extension activation:** Re-register **legacy One Click** settings (`initMemoryBank`, `initMemoryBankDryRun`, `initMemoryBankForce`, `syncCursorRules`, `syncCursorRulesDryRun`, `migrateSkills`, `migrateSkillsScope`, `turnOnAutoScanAfter`, `mergeInstructionsWithoutAutoScan`) under `contributes.configuration`. VS Code rejects `configuration.update` for unknown keys, so migration from pre-0.5.15 booleans failed with *“initMemoryBank is not a registered configuration”* and the extension never activated.

## 0.5.19

- **Hub stuck on loading / moving progress bar:** The webview now **always posts `ready`** in a `finally` block so the host can finish loading even if boot `render()` throws. DOM wiring guards **`#q` / `#scroll`** and uses **`qTrim()`** so a missing search box cannot kill the script. **`gatherHubPayload`** is wrapped in a **12s timeout** and hub refreshes are **serialized** (no parallel payload builds). Removed the eager `_postState()` on view resolve that could race before the webview had attached its message listener.

## 0.5.18

- **MCP & skills hub blank panel:** Initial paint now calls `render()` so **Loading…** shows immediately; **CSS** uses `min-height: 100vh` on `body` and a **minimum height** on the scroll region so sidebar webviews (e.g. secondary sidebar beside Chat) do not collapse the main content to **0px**. If building hub payload throws, the hub still receives **safe defaults** and shows a **warning callout** instead of staying empty.

## 0.5.17

- **Dedupe UX:** Removed the **Guide & tools** side bar tree (commands stay in the Command Palette and **MCP & skills** hub). **Workspace kit** “wizard” row and hub kit row now run **One Click Setup** (settings row on Workspace page opens One Click settings).
- **Workspace wizard command** (`workspaceSetupWizard`) now explains and offers **Run One Click Setup** / **Open One Click settings** instead of duplicating the old four-step flow.
- **GitHub CLI repos:** One palette command **open Intelligence Toolbox repo on GitHub…** (`openIntelligenceToolboxRepos`) with a quick pick; hub **Intelligence** has a single **Toolbox CLI repos** tile; bridge cards’ **GitHub** buttons open the matching repo directly. Legacy commands `openIntelligenceRepoMcpPort` / `MemoryBank` / `RulesConverter` still work for scripts and `executeCommand`.
- **MCP hub chips:** Dropped the extra **@mcp registry** chip (use **Registry** for VS Code’s native browse). **`mcpBrowseRegistry`** remains in the palette.

## 0.5.16

- **MCP & Skills awareness — save, don’t auto-open:** Each scan **overwrites** `.github/cloude-code-toolbox-mcp-skills-awareness.md`. The replaceable MCP/skills block in `.github/copilot-instructions.md` is updated when the scan is **interactive** (e.g. **Scan now**), when **auto-scan on workspace open** is enabled, or when **One Click** requests a one-time merge. No preview editor unless you choose **Open report** on the toast (silent auto-scan stays quiet).
- **Copilot routing hints:** The awareness report and the `copilot-instructions` block now tell Copilot to **match user tasks to configured MCP server ids** (e.g. Confluence work → Confluence/Atlassian MCP) and to use **Agent + MCP** for live tools.
- **Hub / settings copy** updated to describe auto-save and reopen behavior.

## 0.5.15

- **One Click Setup settings — sections:** Configuration is split into titled groups in Settings: **One Click Setup — General**, **Memory Bank**, **Rules**, **Skills**, **MCP**, and **Follow-ups** (plus the main **GitHub Copilot Toolbox** section for npx / Intelligence / translate).
- **Mutually exclusive options → enums:** Replaced overlapping checkboxes with single-select string settings: **`initMemoryBankMode`** (off / dryRun / apply / applyForce), **`syncCursorRulesMode`** (off / dryRun / apply), **`migrateSkillsTarget`** (off / workspace / user / both), **`instructionMergeAfterOneClick`** (enable auto-scan vs one-time copilot-instructions merge vs leave unchanged). VS Code shows these as one-choice controls (dropdown / single-select; not separate conflicting toggles).
- **Migration:** On activate, existing `cloude-code-toolbox.oneClickSetup.*` boolean pairs (and legacy `CloudeCodeToolBox.*` copies) are converted to the new keys and old keys removed where applicable.

## 0.5.14

- **Settings keys:** Contributed configuration now uses the prefix **`cloude-code-toolbox.*`** instead of **`CloudeCodeToolBox.*`**, so the Settings UI no longer humanizes the segment as **“Github …”**. On activate, existing **`CloudeCodeToolBox.*`** values are copied into the new keys and removed from User/Workspace (same defaults). **Commands** remain **`CloudeCodeToolBox.*`**.
- **One Click — Init Memory Bank Force:** Description clarifies default **off** matches the interactive init when you choose **No** / skip if templates already exist; **on** adds **`--force`** (overwrite).
- **Hub — One Click row:** **⚙** is **larger** and placed to the **right** of the **One Click Setup** button.
- **Secondary sidebar** container title: **GitHub Copilot ToolBox** → **GitHub Copilot Toolbox**.

## 0.5.13

- **Intelligence — One Click Setup:** Hub row with **⚙** (opens **One Click Setup** settings) and **One Click Setup** button. Modal confirms you accept responsibility; then runs configurable steps: optional skills migrate, memory-bank init, Cursor rules sync, `.cursorrules` append, Cursor MCP port (workspace merge/overwrite/user/dry/skip), optional turn-on **auto-scan** (respects **workspace vs user** settings scope), MCP & Skills awareness, readiness, config scan, optional first test task. New commands `runOneClickSetup` / `openOneClickSetupSettings`; Guide entries. **Auto-scan checkbox** now writes **Workspace** settings when a folder is open (was always User). Refactors: non-interactive npx helpers for port / rules / memory bank.

## 0.5.12

- **Docs / Marketplace:** Resize **`00-cloude-code-toolbox-access.png`** (smaller dimensions and file size) and simplify first-image alt text so the first README image loads reliably on the Marketplace; screenshot cache `?v=0.5.12` (extension README + GitHub Pages gallery).

## 0.5.11

- **Docs:** Move **After install: open Copilot Toolbox** (with `00-Copilot Toolbox Access.png`) **above** “One place for Copilot-related setup” in root + extension README; dedupe from Screenshots section; TOC + cross-links updated.

## 0.5.10

- **Docs:** Add **`00-Copilot Toolbox Access.png`** as the first README / site screenshot with step-by-step **Activity Bar → Copilot Toolbox → Side Bar → MCP & skills**; hero and gallery updated; cache `?v=0.5.10`.

## 0.5.9

- **Docs:** README polish; **GitHub Pages** install buttons use `vscode:extension/…` with Marketplace fallback; screenshot cache query `?v=0.5.9`.

## 0.5.8

- **Legal / clarity:** Expanded **Disclaimer** in the monorepo README; added **Disclaimer** to the extension README, Marketplace `description` pointer, and GitHub Pages footer (with link to repo disclaimer). Not a substitute for legal counsel.

## 0.5.7

- **Docs:** Lead README and GitHub Pages gallery with **`02-intelligence-cursor-port.png`** (Cursor → Copilot port hero); site hero image matches.

## 0.5.6

- **Docs:** Replaced hub screenshots in `screenshots/` with higher-resolution captures (~2.5k width) for readable UI in README, Marketplace, and the GitHub Pages site; bumped site asset cache keys.

## 0.5.5

- **Docs:** README refresh (sales-focused intro, hub UI reference for every control); updated extension screenshots in `screenshots/`.

## 0.5.4

- **Branding:** Marketplace icon file is now `resources/marketplace-icon.png` (still rendered from `icon-marketplace.svg` when packaging) so the Extensions detail view picks up updates instead of a stale cached `icon.png`.

## 0.5.3

- **Branding:** Marketplace icon is generated from `resources/icon-marketplace.svg` into `resources/icon.png` during `npm run package` (vsce does not allow SVG for `icon`).

## 0.5.2

- **Skills hub:** **Turn OFF** / **Turn ON** — hides a skill in the hub (extension workspace/global state); folders stay on disk. **Delete…** still moves the folder to trash and clears any hub-off flag for that skill.
- **Awareness report & copilot-instructions block:** project/user skills that are **off** in the hub are listed separately from skills shown as on.

## 0.5.1

- **MCP hub:** **Turn OFF** / **Turn ON** — removes a server from `mcp.json` and stores its JSON in extension workspace/global state until restored; **Remove** deletes the entry from `mcp.json` and clears stash (with confirmation).
- **Skills hub:** **Delete…** — moves a skill folder to the OS trash when it lives under a known project or user skill root (same conventions as discovery).
- **Awareness report & copilot-instructions block:** active vs Toolbox-stashed (off) MCP servers shown separately.

## 0.5.0

- **Intelligence hub — Context hygiene:** snapshot (workspace/user MCP counts, `copilot-instructions.md` lines) plus actions: Copilot/MCP file scan (Output), append session notepad → `memory-bank`, SKILL.md stub, verification checklist, bundled MCP recipe merge, run first test-like task.
- **Commands:** `copilotToolboxConfigScan`, `appendNotepadToMemoryBank`, `createSkillStub`, `verificationChecklist`, `applyBundledMcpRecipe`, `runFirstWorkspaceTestTask` (see Command Palette).
- **Session notepad** path renamed to `.vscode/cloude-code-toolbox-notepad.md` (one-time migration from `copilot-kit-notepad.md`).
- **Legal / attribution:** `NOTICE` and description note for MIT-licensed inspiration ([everything-claude-code](https://github.com/affaan-m/everything-claude-code)); sample MCP recipe under `resources/mcp-recipes/`.
- **Readiness / MCP awareness:** optional follow-up actions after opening reports (e.g. open workspace `mcp.json`).
- **Tests:** split MCP/skills merge helpers into `mergeMcpSkillsIntoCopilotInstructionsCore.ts`; Vitest `vscode` alias stub so `npm test` works in Node.
- **Monorepo root:** `package.json` `engines` and `npm run package` for packaging from repo root (avoid `npx vsce` at root).

## 0.4.8

- Extension `README.md`: **Screenshots** section uses `raw.githubusercontent.com` URLs so the VS Code **Extensions** details view shows images (relative `screenshots/` only works from the monorepo root on GitHub).

## 0.4.7

- Packaging: `npm run package` stages the monorepo root `README.md` for the `.vsix` (image links rewritten to `raw.githubusercontent.com`), then restores the extension reference `README.md`.
- Added `@vscode/vsce` devDependency and `package:extension-readme-only` for packaging without swapping README.
- Ignore `scripts/**` in `.vscodeignore` so packaging helpers are not shipped in the VSIX.

## 0.4.6

- Previous release baseline (see git history for details).
