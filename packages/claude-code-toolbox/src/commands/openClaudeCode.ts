import * as vscode from "vscode";

/** Try Anthropic Claude Code extension commands first, then generic VS Code Chat. */
const CANDIDATES = [
  "claude-vscode.editor.open",
  "claude-vscode.newConversation",
  "workbench.action.chat.open",
  "workbench.action.chat.toggle",
];

export async function openClaudeCodePanel(): Promise<void> {
  for (const id of CANDIDATES) {
    try {
      await vscode.commands.executeCommand(id);
      return;
    } catch {
      /* try next */
    }
  }
  try {
    await vscode.env.openExternal(vscode.Uri.parse("vscode://anthropic.claude-code/open"));
    return;
  } catch {
    /* ignore */
  }
  vscode.window.showWarningMessage(
    "Could not open Claude Code automatically. Install the Claude Code extension or use the Command Palette."
  );
}
