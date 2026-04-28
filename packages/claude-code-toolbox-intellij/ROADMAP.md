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

## Agent Teams (new tab)

The VS Code extension now ships a 5th hub tab, **Agent Teams**, covering: native subagent file CRUD under `~/.claude/agents/`, team composition JSON under `~/.claude/teams/`, a custom orchestrator with 7 collaboration protocols (native-task, round-robin, hand-off, orchestrator-led, parallel-fan-out, debate + judge, plan-then-code with user approval gate), a live color-coded transcript, and an SDLC starter pack (9 agents).

### Free for IntelliJ today (zero port work)

- **All on-disk artifacts are shared**. Agent `.md` files, team `.json` files, and run transcripts under `.claude/runs/*/transcript.jsonl` live in the user's home / workspace — the VS Code extension and any future IntelliJ reader will see the same files.
- **Running teams from VS Code** while editing in IntelliJ is already supported: transcripts + `plan.md` land in the workspace and IntelliJ users can open them normally.

### What needs a Kotlin port for full parity

- **Agent Teams tool window tab** in the JCEF hub — re-render the same HTML via the existing `hub/` bridge, then implement these message handlers in Kotlin:
  - `agentTeams.enable`, `agentTeams.installStarterPack`, `agentTeams.refresh`
  - `agentTeams.createAgent / updateAgent / deleteAgent`
  - `agentTeams.createTeam / updateTeam / deleteTeam`
  - `agentTeams.runTeam / stopRun / approvePlan / rejectPlan / openRun`
- **Runtime port** (Kotlin, `ProcessBuilder`-based):
  - `ClaudeCliResolver` — mirror `src/agents/claudeCliResolver.ts` (Windows `.cmd`/`.exe` probing via `PATH` + `PATHEXT`).
  - `ClaudeSpawn` — `ProcessBuilder("claude", …).redirectErrorStream(false).start()`, read stdout line-by-line, parse stream-json → the same `AgentRunEvent` shape.
  - `RunBus` — JVM `ConcurrentLinkedQueue` + coroutine scope per run; append to `.claude/runs/<id>/transcript.jsonl` using `Files.writeString` with `APPEND`.
  - `RunRegistry` + `RunOrchestrator` — straightforward translation of the TS files in `src/agents/runtime/`.
- **Protocol state machines** — port seven files under `src/agents/runtime/protocols/`. Each is ~50–150 lines of TS with no DOM and no VS Code API, so the port is mechanical. Keep the prompt templates byte-identical so agent behavior matches.
- **Approval gate UX** — JCEF modal or Swing dialog bound to the same `agentTeams.approvePlan` / `agentTeams.rejectPlan` messages.
- **Tests** — port `src/agents/runtime/protocols/protocols.test.ts` to JUnit; the scripted-spawner pattern works identically (just an interface the runner injects).

### Suggested phased Kotlin rollout

1. **Read-only first** — the Teams tab UI with agent/team CRUD and the Enable + starter-pack hero. All reuses the existing file-on-disk data, no orchestrator needed. Covers 80% of value; zero Kotlin runtime work.
2. **Native-task runtime** — port `ClaudeSpawn` + `RunBus` + `nativeTask` protocol. Unlocks Run for every native-runtime team.
3. **Custom-runtime protocols** — port the six remaining protocols. Unlocks debate + plan-then-code + approval gate. Largest chunk.
4. **Streaming transcript in JCEF** — the webview HTML already renders `at-run-panel` cards; wire the IntelliJ side to push `agentTeams.runEvent` messages with the same payload shape.

## Contributing

- Issues: [GitHub / intellij label](https://github.com/amitchorasiya/Cloude-Code-ToolBox/issues).
- A shared **JVM library** for MCP JSON + migration helpers would help both IDEs.
