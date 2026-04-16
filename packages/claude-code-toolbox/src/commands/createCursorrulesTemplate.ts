import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

const STUB = `# Cursor / Copilot shared hints (root rules)

- Keep answers concise.
- Match existing code style.

`;

export async function createCursorrulesTemplate(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const uri = vscode.Uri.joinPath(folder.uri, ".cursorrules");
  try {
    await vscode.workspace.fs.stat(uri);
    vscode.window.showWarningMessage(".cursorrules already exists.");
    await vscode.window.showTextDocument(uri);
    return;
  } catch {
    /* ok */
  }
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(STUB));
  await vscode.window.showTextDocument(uri);
  vscode.window.showInformationMessage(
    "Created .cursorrules — then use Cloude Code ToolBox: Append .cursorrules to Copilot instructions when ready."
  );
}
