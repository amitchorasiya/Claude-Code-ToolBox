# Claude Code ToolBox for JetBrains

**The same Claude Code control panel, native in IntelliJ IDEA, PyCharm, WebStorm, and all JetBrains IDEs.**

You're running Claude Code from your JetBrains terminal, but there's no UI to manage MCP servers, see skills, or coordinate multi-agent workflows. Claude Code ToolBox brings the full hub experience to JetBrains — with complete Agentic Teams parity.

**Install:** [JetBrains Marketplace](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) · [`jetbrains://` install (opens IDE)](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox) · or build from source below

**Also use VS Code?** Get the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) for the primary shipping surface.

---

## What you get

- **Full MCP & Skills hub** — browse, install, manage servers and skills from a JCEF webview
- **Agentic Teams (all 8 protocols)** — debate + judge, plan-then-code with approval gate, converge, orchestrator, parallel fan-out, round-robin, handoff, native-task
- **10-agent SDLC starter pack** — product-manager, architect, security-reviewer, backend/frontend dev, QA, code-reviewer, devops, tech-writer, UI/UX designer
- **Live transcript** — color-coded, per-turn tokens + cost, approve/reject modal, Stop button
- **Swarm dispatch** — every team auto-generates a `/command` that fires all agents in parallel
- **One Click migration** — port Cursor MCP, rules, and memory bank into Claude Code config
- **Workspace kit** — checklist for rules, `CLAUDE.md`, memory bank, `mcp.json`

**What's still VS Code-only:** Agent Dashboard (hook server + transcript watcher). See [ROADMAP.md](ROADMAP.md).

---

## Screenshots

Same hub UI renders in both VS Code and JetBrains:

![Activity Bar → Claude Code ToolBox; Side Bar → MCP & skills hub](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/00-toolbox-access.png?v=0.6.20)

![Intelligence tab: Cursor to VS Code + Claude Code bridges](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/01-intelligence.png?v=0.6.20)

---

## Requirements

- **JDK 21** (matches `jvmToolchain(21)` in `build.gradle.kts`)
- **Node.js + npm** on PATH (for bridge CLI bundling during build)
- Optional: IntelliJ IDEA with Plugin DevKit for local debugging

---

## Build

```bash
cd packages/claude-code-toolbox-intellij
./gradlew buildPlugin
```

Plugin ZIP lands in `build/distributions/`. Install via **Settings → Plugins → Install from Disk**.

## Run in sandbox

```bash
./gradlew runIde
```

Then **View → Tool Windows → Claude Code ToolBox**.

---

## Hub HTML sync

The JCEF UI loads `src/main/resources/hub/hub-body.html`, exported from the VS Code webview source:

```bash
cd packages/claude-code-toolbox
npm run compile && npm run export:hub-for-intellij
```

---

## Publishing to JetBrains Marketplace

| Topic | Link |
|-------|------|
| First upload + signing | [Publishing a Plugin](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html) |
| Listing best practices | [Marketplace Listing](https://plugins.jetbrains.com/docs/marketplace/best-practices-for-listing.html) |
| Automated publish | `./gradlew publishPlugin` with [Personal Access Token](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html#providing-your-personal-access-token-to-gradle) |

---

## License

[MIT](../../LICENSE) — see monorepo root.
