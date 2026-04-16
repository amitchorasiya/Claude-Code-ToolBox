import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

/** Relative path from workspace root to the session notepad file. */
export const SESSION_NOTEPAD_REL = ".vscode/cloude-code-toolbox-notepad.md";

/** Previous filename; migrated once when the new file is missing. */
const LEGACY_SESSION_NOTEPAD_REL = ".vscode/copilot-kit-notepad.md";

const DEFAULT_CONTENT = `# Cloude Code ToolBox — session notepad

Pin context here for **this session**. Before chatting, run **Cloude Code ToolBox: Copy notepad to clipboard** and paste into Claude Code if needed.

---

`;

/** Canonical notepad URI after one-time migration from `copilot-kit-notepad.md` if needed. */
export async function resolveSessionNotepadUri(
  folder: vscode.WorkspaceFolder
): Promise<vscode.Uri> {
  return migrateLegacySessionNotepadIfNeeded(folder);
}

/** If only the legacy notepad exists, copy it to the new path and remove the old file. */
async function migrateLegacySessionNotepadIfNeeded(folder: vscode.WorkspaceFolder): Promise<vscode.Uri> {
  const uri = vscode.Uri.joinPath(folder.uri, ...SESSION_NOTEPAD_REL.split("/"));
  try {
    await vscode.workspace.fs.stat(uri);
    return uri;
  } catch {
    /* missing */
  }
  const legacy = vscode.Uri.joinPath(folder.uri, ...LEGACY_SESSION_NOTEPAD_REL.split("/"));
  try {
    await vscode.workspace.fs.stat(legacy);
    const buf = await vscode.workspace.fs.readFile(legacy);
    await vscode.workspace.fs.writeFile(uri, buf);
    await vscode.workspace.fs.delete(legacy);
  } catch {
    /* no legacy */
  }
  return uri;
}

export async function openSessionNotepad(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const uri = await migrateLegacySessionNotepadIfNeeded(folder);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    const enc = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, enc.encode(DEFAULT_CONTENT));
  }
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}

/** Append a markdown block to the session notepad (creates file with default header if missing). */
export async function appendToSessionNotepad(markdownBlock: string): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const uri = await migrateLegacySessionNotepadIfNeeded(folder);
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let body = "";
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    body = dec.decode(buf);
  } catch {
    await vscode.workspace.fs.writeFile(uri, enc.encode(DEFAULT_CONTENT));
    body = DEFAULT_CONTENT;
  }
  const stamp = `\n\n---\n\n## Appended context pack — ${new Date().toISOString()}\n\n`;
  await vscode.workspace.fs.writeFile(
    uri,
    enc.encode(`${body.trimEnd()}${stamp}${markdownBlock}\n`)
  );
}

export async function copySessionNotepadToClipboard(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const uri = await migrateLegacySessionNotepadIfNeeded(folder);
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(buf);
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage("Notepad copied to clipboard — paste into Copilot Chat.");
  } catch {
    vscode.window.showErrorMessage(
      "Create the notepad first: Cloude Code ToolBox: Open session notepad."
    );
  }
}
