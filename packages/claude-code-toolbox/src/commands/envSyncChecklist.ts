import * as vscode from "vscode";

export async function showEnvSyncChecklist(): Promise<void> {
  const lines = [
    "## Cursor → VS Code + Claude Code checklist",
    "",
    "Copy items into your notes; check off as you go.",
    "",
    "### Editor",
    "- [ ] Install **Claude Code** (`anthropic.claude-code`) and sign in",
    "- [ ] VS Code **1.99+** for MCP support",
    "- [ ] Optional: import useful settings from Cursor `settings.json` (many keys differ — merge manually)",
    "",
    "### This workspace",
    "- [ ] **MCP:** Port `~/.cursor/mcp.json` → VS Code `mcp.json` (Cloude Code ToolBox)",
    "- [ ] **Rules:** `npx cursor-rules-to-claude` or append `.cursorrules` → `CLAUDE.md`",
    "- [ ] **Memory:** `npx cloude-code-memory-bank init` (optional; bundled CLI also available)",
    "- [ ] **Session notepad:** `.vscode/cloude-code-toolbox-notepad.md`",
    "",
    "### Extensions",
    "- [ ] Reinstall Marketplace equivalents for Cursor-only extensions",
    "- [ ] Keybindings: consider **Ctrl+Alt+K** for the toolbox inline shortcut",
    "",
    "### Docs",
    "- [ ] **Cloude Code ToolBox: Open Cursor vs Claude Code reference**",
    "- [ ] **Cloude Code ToolBox: Open Claude Code account / pricing docs**",
    "",
  ];

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
  vscode.window.showInformationMessage(
    "Checklist is an unsaved buffer — copy or save if you want to keep it."
  );
}
