import * as path from "node:path";
import * as os from "node:os";
import * as vscode from "vscode";

/**
 * Opens `~/.claude/settings.json` if it exists; otherwise offers to reveal `~/.claude` in the OS file manager.
 * Claude Code reads MCP and other config here; VS Code `mcp.json` is separate.
 */
export async function openClaudeUserSettingsJson(): Promise<void> {
  const dir = path.join(os.homedir(), ".claude");
  const fileUri = vscode.Uri.file(path.join(dir, "settings.json"));
  try {
    await vscode.workspace.fs.stat(fileUri);
    await vscode.window.showTextDocument(fileUri);
    return;
  } catch {
    /* missing */
  }
  const pick = await vscode.window.showInformationMessage(
    `No file at ${fileUri.fsPath}. Create it in Claude Code or reveal the folder to add one.`,
    "Reveal .claude folder"
  );
  if (pick === "Reveal .claude folder") {
    try {
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(dir));
    } catch {
      await vscode.window.showInformationMessage(`Open this folder in your file manager: ${dir}`);
    }
  }
}
