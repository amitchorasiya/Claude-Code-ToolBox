# cloude-code-memory-bank

**Give Claude Code persistent project memory in 30 seconds.**

Claude Code forgets everything between sessions. This CLI scaffolds a structured memory bank (Markdown files your team commits) and wires it into `CLAUDE.md` so Claude Code always knows where your project left off.

```bash
npx cloude-code-memory-bank init
```

That's it. Your repo now has a `memory-bank/` folder with structured context files and a bounded block in `CLAUDE.md` that Claude Code reads automatically.

---

## What it creates

```text
your-repo/
├── CLAUDE.md                      # bounded block merged (other content preserved)
└── memory-bank/
    ├── projectbrief.md            # scope and goals
    ├── productContext.md          # product intent and UX
    ├── activeContext.md           # current focus and decisions
    ├── systemPatterns.md          # architecture and conventions
    ├── techContext.md             # stack and constraints
    └── progress.md               # done, pending, known issues
```

**No hidden servers, no databases.** Plain Markdown you maintain and commit alongside your code.

---

## Why?

- Claude Code reads `CLAUDE.md` on every session start — the memory bank block gives it project continuity
- Team members share the same structured context instead of re-explaining the project each time
- Works with Claude Code, Cursor (optional `.cursor/rules` install), and any tool that reads `CLAUDE.md`

---

## Usage

```bash
npx cloude-code-memory-bank init [options]
```

| Option | Description |
|--------|-------------|
| `--cwd <dir>` | Project root (default: current directory) |
| `--bank-dir <path>` | Memory folder path relative to cwd (default: `memory-bank`) |
| `--dry-run` | Preview actions without writing |
| `--cursor-rules` | Also install `.cursor/rules/memory-bank.mdc` and `core.mdc` |
| `--no-claude-md` | Skip `CLAUDE.md` merge (memory bank files only) |

**Safe to re-run:** existing memory files are never overwritten. `CLAUDE.md` is updated only within bounded markers.

---

## Part of Claude Code ToolBox

This CLI is bundled in the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) and [JetBrains plugin](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) — accessible via One Click Setup or the Intelligence tab without needing `npx`.

**Monorepo:** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox)

---

## License

MIT — see `LICENSE`.
