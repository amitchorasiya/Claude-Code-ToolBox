import * as vscode from "vscode";

const INLINE_CANDIDATES = [
  "claude-vscode.editor.open",
  "inlineChat.start",
  "editor.action.inlineChat.start",
  "workbench.action.chat.open",
];

export async function openInlineChatCursorStyle(): Promise<void> {
  for (const id of INLINE_CANDIDATES) {
    try {
      await vscode.commands.executeCommand(id);
      return;
    } catch {
      /* try next */
    }
  }
  vscode.window.showWarningMessage(
    "Inline chat not available. Install Claude Code or enable VS Code inline chat."
  );
}
