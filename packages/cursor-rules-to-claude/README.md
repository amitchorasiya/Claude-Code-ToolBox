# cursor-rules-to-claude

Converts **Cursor** `.cursor/rules` (`*.mdc`) into:

- **`CLAUDE.md`** — merged “always apply” rules at the repo root
- **`.claude/rules/*.md`** — scoped rules (with path hints in a leading comment)

Published as **`cursor-rules-to-claude`** on npm; sources live in this monorepo: [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox) (`packages/cursor-rules-to-claude/`). **Claude Code ToolBox** ([VS Code](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) · [JetBrains](https://plugins.jetbrains.com/search?search=Cloude+Code+ToolBox) · [`jetbrains://…`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox)) can invoke this CLI via **`npx`** or bundled bridge paths.

## Usage

```bash
npx cursor-rules-to-claude --help
```

## License

MIT.
