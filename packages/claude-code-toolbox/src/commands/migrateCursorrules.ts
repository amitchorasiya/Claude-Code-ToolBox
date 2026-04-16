import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

const BANNER_START = "<!-- cloude-code-toolbox:cursorrules-begin -->";
const BANNER_END = "<!-- cloude-code-toolbox:cursorrules-end -->";

export async function appendCursorrules(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const rulesUri = vscode.Uri.joinPath(folder.uri, ".cursorrules");
  let rulesText: string;
  try {
    const buf = await vscode.workspace.fs.readFile(rulesUri);
    rulesText = new TextDecoder().decode(buf).trim();
  } catch {
    vscode.window.showErrorMessage("No .cursorrules file found at workspace root.");
    return;
  }

  if (!rulesText) {
    vscode.window.showWarningMessage(".cursorrules is empty.");
    return;
  }

  const outUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");

  const block = [
    "",
    BANNER_START,
    "",
    "## Migrated from `.cursorrules` (via Cloude Code ToolBox)",
    "",
    rulesText,
    "",
    BANNER_END,
    "",
  ].join("\n");

  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(outUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    /* new file */
  }

  let next: string;
  if (!existing.trim()) {
    next = `# Claude Code — project context\n${block}`;
  } else if (existing.includes(BANNER_START) && existing.includes(BANNER_END)) {
    const re = new RegExp(
      `${escapeRe(BANNER_START)}[\\s\\S]*?${escapeRe(BANNER_END)}\\n*`,
      "m"
    );
    next = existing.replace(re, block);
  } else {
    next = existing.trimEnd() + block;
  }

  await vscode.workspace.fs.writeFile(outUri, new TextEncoder().encode(next));
  await vscode.window.showTextDocument(outUri);
  vscode.window.showInformationMessage("Merged .cursorrules into CLAUDE.md (replaceable block).");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
