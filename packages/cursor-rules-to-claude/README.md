# cursor-rules-to-claude

**Moving from Cursor to Claude Code? Bring your rules with you.**

You've built up `.cursor/rules/*.mdc` files that make Cursor work the way you want. This CLI converts them into Claude Code's format so you don't lose any of that context.

```bash
npx cursor-rules-to-claude
```

---

## What it does

- Reads `.cursor/rules/*.mdc` from your project
- "Always apply" rules merge into `CLAUDE.md` at the repo root
- Scoped rules become `.claude/rules/*.md` (with path hints)
- Existing content is preserved (merge, not replace)

---

## Part of Claude Code ToolBox

This CLI is bundled in the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) and [JetBrains plugin](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) — runs automatically during One Click Setup migration.

**Monorepo:** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox)

---

## License

MIT.
