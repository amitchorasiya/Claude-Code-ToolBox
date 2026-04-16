# Cursor vs Claude Code in VS Code — quick reference

## Rules / project instructions

| Cursor | Claude Code |
|--------|----------------|
| `.cursorrules` (repo root) | `CLAUDE.md` (repo root) |
| `.cursor/rules/*.mdc`, `.md` | `.claude/rules/*.md` (after **Sync Cursor rules**) |

**This toolbox:** `npx cursor-rules-to-claude`, or **Cloude Code ToolBox: Append .cursorrules to CLAUDE.md**.

## Context in chat

| Cursor | Claude Code |
|--------|-------------|
| `@file` / `@Files` | `@` file picker in the Claude panel |
| `@codebase` | Ask Claude to search / explore the repo |
| `@web` | Paste links or use browser tools where enabled |

## Inline / editor shortcuts

| Cursor | Claude Code |
|--------|-------------|
| **Ctrl+K** (inline edit) | **Alt+K** / **Option+K** inserts `@path#line` (see Claude Code docs) |

**Cloude Code ToolBox** adds **Ctrl+Alt+K** (**Cmd+Alt+K** on Mac) → open Claude Code / inline flow when bound, or run **Open inline chat (Cursor-style)**.

## Chat UI

- **Cursor Composer** — multi-file panel workflow.
- **Claude Code** — panel, tabs, plan review. Use **Open Claude Code** from this toolbox.

## Billing / account

- See [Claude Code VS Code docs](https://code.claude.com/docs/en/vs-code/) and [Anthropic pricing](https://www.anthropic.com/pricing).

## Session notepad

**Cloude Code ToolBox session notepad:** `.vscode/cloude-code-toolbox-notepad.md` — **Copy notepad to clipboard** before sending a prompt, or keep it split with the Claude panel.

## Settings sync (Cursor → VS Code)

- Merge Cursor `settings.json` into VS Code carefully (keys differ).
- **MCP:** **Port Cursor MCP** writes VS Code `mcp.json`; Claude Code also uses `~/.claude/settings.json` and `/mcp` in the panel.
