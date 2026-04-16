# IntelliJ plugin — feature parity with VS Code

The **VS Code** extension embeds **Node CLIs**, **native MCP UI**, **webview panels** (session notepad, composer hub), and **dozens of TypeScript-only flows**. The IntelliJ plugin matches what can run on the JVM + `npx`/`node` on the user machine, and documents gaps where the host is VS Code–specific.

## What is implemented (0.5.0+)

- **Hub (JCEF)**: same exported HTML as VS Code; MCP/skills registry HTTP; MCP stash + install; skills CLI via Run window; settings file + **Settings → Tools** UI (incl. npx tag, Insiders paths).
- **Every `CloudeCodeToolBox.*` command id** is registered; **[ToolboxParityDispatcher](src/main/kotlin/com/amitchorasiya/cloude/toolbox/intellij/parity/ToolboxParityDispatcher.kt)** routes to:
  - **Run tool window `npx`**: `cursor-mcp-vscode-port`, `cursor-rules-to-claude`, `cloude-code-memory-bank` (with dialogs approximating VS Code quick picks).
  - **Files / browser**: open `mcp.json`, Claude user JSON, kit targets (`runCommandWithArgs`), GitHub URLs, MCP registry.
  - **Workspace**: `.vscode/settings.json` toggle for `chat.mcp.discovery.enabled`; `.cursorrules` template; **skills migration** `.cursor/skills` → `.agents/skills` (Kotlin port of TS migration).
  - **Hub refresh** after CLI/migration via **[CloudeHubBridge](src/main/kotlin/com/amitchorasiya/cloude/toolbox/intellij/hub/CloudeHubBridge.kt)**.
- **User `mcp.json` path** respects **Insiders** vs stable from toolbox JSON (aligned with VS Code).

## Still VS Code–first (interactive / API–bound)

- **One Click Setup** orchestration, **context pack**, **Thinking Machine priming**, **MCP & skills awareness writer**, **readiness**, **verification checklist**, **session notepad / composer / inline chat proxies** — these depend on VS Code APIs, webviews, or large TS-only logic. The dispatcher shows an informational notice; use **VS Code** for the full guided UX, or contribute JVM ports in the monorepo.
- **Native MCP list/add** (VS Code `@mcp` UI) — not available in IntelliJ; use the **hub** or VS Code.
- **Bundled extension `node_modules` CLIs** without `npx` — the VS Code extension resolves paths inside its install; IntelliJ uses **`npx package@tag`** for the same packages (network/cache as per npm).

## Contributing

- Issues: [GitHub / intellij label](https://github.com/amitchorasiya/Cloude-Code-ToolBox/issues).
- A shared **JVM library** for MCP JSON + migration helpers would help both IDEs.
