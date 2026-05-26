# cursor-mcp-vscode-port

**Bring your Cursor MCP servers to VS Code and Claude Code in one command.**

You've configured MCP servers in Cursor and now you're moving to VS Code + Claude Code. Instead of manually recreating each server definition, this CLI reads `~/.cursor/mcp.json` and merges everything into your VS Code or Claude Code config.

```bash
npx cursor-mcp-vscode-port
```

---

## What it does

- Reads Cursor's `~/.cursor/mcp.json` (all configured servers)
- Converts to VS Code / Claude Code format
- **Merges** into the destination config (existing servers preserved, duplicates overwritten)
- Never replaces the entire target file

---

## Part of Claude Code ToolBox

This CLI is bundled in the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) and [JetBrains plugin](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox) — runs automatically during One Click Setup migration.

**Monorepo:** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox)

---

## License

MIT.
