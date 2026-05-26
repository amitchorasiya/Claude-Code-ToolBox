# Claude Code ToolBox

**Claude Code doesn't ship with a control panel. This is it.**

You're running Claude Code in VS Code, but you can't see what MCP servers are active, which skills are loaded, whether your team's config matches yours, or what your agents are actually doing. Setup is scattered across dotfiles, JSON configs, and tribal knowledge.

**Claude Code ToolBox gives you:**

- **Agentic Teams** — 10 specialized AI agents (architect, security, frontend, backend, QA...) that debate designs, plan implementations you approve, then execute together. One Claude session becomes a whole engineering team.
- **A visual MCP & skills hub** — see, search, install, and manage everything from one sidebar
- **Live Agent Dashboard** — every running Claude Code session on your machine, with real-time cost tracking and context visibility
- **One-click migration** — bring your Cursor or Copilot setup (MCP, rules, skills) into Claude Code automatically
- **Workspace-aware context priming** — Claude Code finally knows what your project actually has configured

**2,000+ installs** · Works on macOS, Windows, Linux · Also ships as a [JetBrains plugin](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox)

**[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode)** · [GitHub](https://github.com/amitchorasiya/Claude-Code-ToolBox)

---

## Agentic Teams: Why One Agent Isn't Enough

A single Claude Code session does everything: plan, code, review, test. That's like one person doing every role. **Agentic Teams splits the work across specialized agents that challenge each other** — the architect plans, the security reviewer pokes holes, the QA engineer writes tests, and you approve before anyone writes code.

10 role-based agents collaborate through 8 protocols:

- **Debate + Judge** — agents argue both sides, a judge synthesizes
- **Plan-then-Code** — architect plans, you approve, devs execute
- **Converge** — parallel thinking → cross-pollination → synthesis
- **Swarm dispatch** — every team is a `/command` that fires all agents in parallel

One-click setup enables `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and installs agents to `~/.claude/agents/` where Claude Code discovers them natively.

![Agentic Teams: teams with protocols, swarm dispatch, and one-click Run](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/10-agentic-teams.png?v=1.0.34)

---

## Skill-Backed Agents with Long-Term Memory

Each agent can be pointed at a **SKILL.md** instead of a freeform prompt — structured, reusable expertise. Agents also have **per-agent long-term memory**: they learn from interactions and retain knowledge across runs.

![Agents: role-tagged, skill-backed, with long-term memory](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/11-agents.png?v=1.0.34)

---

## Agent Dashboard: Live Visibility

Opt-in dashboard shows a card for every running Claude Code session. Token-based cost estimates, context-window fill %, live tool feed, grouped by workspace.

![Agent Dashboard: live session cards with cost, context, tools, and LTM toggle](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/12-ltm-agent-dashboard.png?v=1.0.34)

---

## Intelligence: Context & Migration Hub

**One Click Setup** migrates your team from Cursor and/or Copilot to Claude Code automatically — ports MCP servers, syncs rules to `CLAUDE.md`, scaffolds memory bank, and migrates skills. All using bundled CLIs (no network `npx` fetch).

**Thinking Machine Mode** primes Claude Code with MCP & skills awareness, context packs, and readiness checks — making "refresh what this repo knows" a single action.

![Intelligence tab: Cursor to VS Code + Claude Code bridges, context packs, and readiness](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/01-intelligence.png?v=1.0.34)

![Intelligence: Port Cursor MCP, rules, and memory bank to VS Code + Claude Code](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/02-intelligence-cursor-port.png?v=1.0.34)

---

## MCP & Skills Hub

Browse and manage MCP servers and skills from one place. Reads Claude Code's native config (`~/.claude.json` for user, `.mcp.json` for project). Registry browse, install, stash/hide — no more raw JSON editing.

![MCP: installed workspace servers](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/03-mcp-browse-workspace-servers.png?v=1.0.34)

![MCP: registry browse & search](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/04-mcp-registry-search.png?v=1.0.34)

![Skills: catalog (skills.sh)](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/05-skills-catalog-skills-sh.png?v=1.0.34)

![Skills: installed local skill folders](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/06-skills-installed-local.png?v=1.0.34)

---

## Workspace Kit

A visual checklist for everything Claude Code needs: rules, memory bank, `CLAUDE.md`, `mcp.json` — see what exists and what's missing at a glance.

![Workspace kit checklist](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/07-workspace-checklist.png?v=1.0.34)

![Workspace: toolbox commands](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/08-workspace-toolbox-commands.png?v=1.0.34)

---

## Getting Started

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode)
2. Click **Claude Code ToolBox** in the Activity Bar (left icon column)
3. Open **MCP & skills** from the Side Bar

![Activity Bar → Claude Code ToolBox; Side Bar → MCP & skills hub](https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main/screenshots/00-toolbox-access.png?v=1.0.34)

---

## 7 Preset Swarm Commands

Ship with the starter pack — each dispatches all team agents in parallel:

| Command | What it does |
|---------|-------------|
| `/plan-team` | Architect + PM plan, you approve, devs build |
| `/debate-team` | Agents debate approaches, judge picks the winner |
| `/review-team` | Multi-perspective code review |
| `/security-team` | Threat modeling + vulnerability scan |
| `/sdlc-plan-then-code` | Full SDLC: plan → approve → implement → test → review |
| `/refactor-team` | Parallel refactoring with cross-review |
| `/spec-team` | Spec generation with multi-agent validation |

---

## Requirements

| Requirement | Notes |
|-------------|--------|
| VS Code | **1.99+** |
| Claude Code | Install the Claude Code extension |
| Node.js | **20+** for bundled CLIs |

---

## Key Settings

| Setting | Purpose |
|---------|---------|
| `claude-code-toolbox.agentTeams.*` | Model, protocol, max concurrent agents, cost cap |
| `claude-code-toolbox.agentDashboard.*` | Enable/disable dashboard, hook port, safety alerts |
| `claude-code-toolbox.oneClickSetup.*` | Migration tracks (Cursor, Copilot) |
| `claude-code-toolbox.intelligence.*` | Context pack, auto-scan, notepad |
| `claude-code-toolbox.thinkingMachineMode.*` | Priming and awareness behavior |

---

## Cross-Platform

Works on **macOS**, **Windows**, and **Linux**. Full **JetBrains parity** ships as a separate [IntelliJ plugin](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) with the complete Agentic Teams runtime.

---

## Disclaimer

**Independence and trademarks.** Claude Code ToolBox is **independent** community tooling. It is **not** affiliated with, endorsed by, or maintained by Microsoft, GitHub, Cursor, OpenAI, Anthropic, or other vendors. Product names may be trademarks of their respective owners.

**MIT "AS IS".** Licensed under the [MIT License](LICENSE). Not professional services, security audit, or legal review.

**Your responsibility.** Backups, secrets hygiene, and policy compliance are yours.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 amitchorasiya.
