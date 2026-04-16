# Cursor MCP → VS Code `mcp.json` port

CLI and library that ports **Cursor** `~/.cursor/mcp.json` into **Visual Studio Code** `mcp.json` (user or workspace) so MCP servers can be reused across editors.

If the destination **`mcp.json` already exists**, converted Cursor servers are **merged** into it (same server ids are overwritten with the new definition; other keys are preserved). The CLI **never** replaces the entire file in one shot.

**Monorepo:** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox) (`packages/cursor-mcp-vscode-port/`). **Claude Code ToolBox** bundles this CLI in the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) and the [JetBrains plugin](https://plugins.jetbrains.com/search?search=Cloude+Code+ToolBox) ([`jetbrains://…`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox)).

See the upstream Model Context Protocol docs for what MCP is and how servers are configured.

## CLI

```bash
npx cursor-mcp-vscode-port --help
```

## License

MIT (vendored from prior tooling; see repository NOTICE if applicable).
