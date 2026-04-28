# Claude Code ToolBox — IntelliJ / JetBrains (preview)

**Version:** `0.6.18` (see `version` in [`build.gradle.kts`](build.gradle.kts)).

**Also use VS Code?** The primary shipping surface is the **[VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode)** (`amitchorasiya.claude-code-toolbox-vscode`).

**Install this plugin (JetBrains):** [Search JetBrains Marketplace](https://plugins.jetbrains.com/search?search=Cloude+Code+ToolBox) · [`jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox) (opens your IDE) · or build a `.zip` from this package (below).

Gradle-based [IntelliJ Platform](https://plugins.jetbrains.com/docs/intellij/welcome.html) plugin. **Preview:** JCEF **hub** (MCP, skills, Intelligence, workspace flows) with ongoing parity vs **[VS Code](../claude-code-toolbox/)**; see plugin description and [ROADMAP.md](ROADMAP.md).

**Screenshots** (same hub UI as VS Code; captures from VS Code — see [monorepo `screenshots/`](https://github.com/amitchorasiya/Claude-Code-ToolBox/tree/main/screenshots)):

![Activity Bar → Claude Code ToolBox; Side Bar → MCP & skills hub](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/00-toolbox-access.png?v=0.6.12)

![Intelligence tab: Cursor to VS Code + Claude Code bridges](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/01-intelligence.png?v=0.6.12)

**Feature parity** with VS Code is a **large, multi-phase** effort (JCEF hub, Kotlin bridge, MCP/skills/CLI integrations). See **[ROADMAP.md](ROADMAP.md)** for the technical plan—not something that can be toggled on in one release.

## Requirements

- **JDK 21** (Gradle JVM; matches `jvmToolchain(21)` in `build.gradle.kts`)
- Optional: **IntelliJ IDEA** with the Plugin DevKit for local debugging

## Hub HTML (keep in sync with VS Code)

The JCEF UI loads **`src/main/resources/hub/hub-body.html`**, generated from the same source as the VS Code webview:

```bash
cd packages/claude-code-toolbox
npm run compile
npm run export:hub-for-intellij
```

Run this after changing `hubWebviewDocument.ts` (or run **`npm run rebuild:extensions`** from the monorepo root, which compiles, exports the hub, then builds VSIX + plugin).

## Build

Requires **Node.js + npm** on `PATH` so Gradle can run `npm install --production` inside the staged **cursor-rules-to-claude** package (gray-matter dependency). Bridge CLIs are copied from sibling folders under `packages/` and packed into the plugin JAR — they are **not** fetched from the public npm registry at runtime.

```bash
cd packages/claude-code-toolbox-intellij
./gradlew buildPlugin
```

The plugin ZIP is under `build/distributions/`.

## Run in a sandbox IDE

```bash
./gradlew runIde
```

Then **View → Tool Windows → Claude Code ToolBox** (or find it on the right tool window bar).

## Agent Teams & Dashboard (VS Code-only today — IntelliJ port scoped in ROADMAP)

The 🤝 **Teams** tab (agent CRUD, 7 collaboration protocols including **debate + judge** and **plan-then-code**, live transcript, Agent Dashboard, Claude Code slash commands) ships in the **VS Code extension 1.0.17+**.

**What's already shared** even without a Kotlin port: everything lives on disk. Agents (`~/.claude/agents/*.md`), teams (`~/.claude/teams/*.json`), run transcripts (`<ws>/.claude/runs/<id>/transcript.jsonl`), and slash-command bridges (`~/.claude/commands/*.md`) are all plain files. If you create or edit them in VS Code, they immediately work from any `claude` session — including one launched from a JetBrains terminal. The slash commands in particular (`/plan-team`, `/debate-team`, `/review-team`, `/security-team`, `/refactor-team`, `/spec-team`) work regardless of which IDE you're in, because Claude Code resolves them from `~/.claude/commands/`.

**What still needs a Kotlin port** (scoped in [ROADMAP.md](ROADMAP.md)):
- JCEF panel for the Teams tab UI.
- `ProcessBuilder`-based runtime (`ClaudeSpawn`, `RunBus`, `SessionStore`) — mechanical port of `src/agents/runtime/*` and `src/agents/dashboard/*` from the VS Code extension.
- Hook server rebound via Kotlin HTTP stack (same IPv4-pinned loopback design, Windows-safe).

## Not feature parity (yet)

Roadmap items (shared product goals with VS Code) belong in the main repo; implementation here will grow independently. See the root [README.md](../../README.md).

**CI:** [`.github/workflows/intellij-ci.yml`](../../.github/workflows/intellij-ci.yml) runs **`./gradlew buildPlugin`** on pushes that touch this package (Ubuntu, JDK 21).

## JetBrains Marketplace and quality bar

**Compatibility verification (DataSpell):** If the Marketplace **Compatibility verification** table shows DataSpell with *Unable to verify: Product DS is not supported yet* (or a license note), that reflects **JetBrains Plugin Verifier / Marketplace** support for that product version—not a failure of this plugin. This repo’s Gradle config verifies the plugin against **IntelliJ IDEA** only (`pluginVerification.ides.select { IntellijIdea }`), which matches the primary target; IDEA rows should show **Compatible**. If DS verification stays unavailable, rely on IDEA results or contact JetBrains via the [Marketplace documentation](https://plugins.jetbrains.com/docs/marketplace/) / vendor portal.

`plugin.xml` and Gradle follow JetBrains guidance so you can move from “install from disk” to Marketplace when ready:

| Topic | Documentation |
|--------|----------------|
| Publishing (first upload, signing, `publishPlugin`, tokens) | [Publishing a Plugin](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html) |
| UX (stability, performance, discoverability) | [Plugin User Experience (UX)](https://plugins.jetbrains.com/docs/intellij/plugin-user-experience.html) |
| Listing (name, description, media, tags) | [Best practices for listing your plugin](https://plugins.jetbrains.com/docs/marketplace/best-practices-for-listing.html) |

**Typical path to Marketplace:** verify in a clean IDE (`buildPlugin` → install ZIP from `build/distributions/`), meet [plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html) requirements for uploads, complete the **first manual upload** in the Marketplace UI, then use **`./gradlew publishPlugin`** with a [Personal Access Token](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html#providing-your-personal-access-token-to-gradle) (`intellijPlatformPublishingToken` in `gradle.properties` or env). Optional [release channels](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html#specifying-a-release-channel) (e.g. `beta`) can be used for wider testing before the default channel.

## Local install (no Marketplace)

**Settings → Plugins → ⚙ → Install Plugin from Disk…** and select the ZIP under `build/distributions/`.
