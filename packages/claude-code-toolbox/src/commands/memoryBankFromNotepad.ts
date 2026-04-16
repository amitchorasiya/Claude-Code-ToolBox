import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { resolveSessionNotepadUri } from "./sessionNotepad";

async function collectMemoryBankMarkdownUris(root: vscode.Uri): Promise<vscode.Uri[]> {
  const pattern = new vscode.RelativePattern(root, "memory-bank/**/*.md");
  const found = await vscode.workspace.findFiles(pattern, null, 200);
  return found.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

/** Append session notepad content to a chosen memory-bank markdown file (preview, then apply). */
export async function appendNotepadToMemoryBank(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const notepadUri = await resolveSessionNotepadUri(folder);
  let notepadText: string;
  try {
    const buf = await vscode.workspace.fs.readFile(notepadUri);
    notepadText = new TextDecoder().decode(buf).trim();
  } catch {
    vscode.window.showErrorMessage("Open or create the session notepad first.");
    return;
  }
  if (!notepadText) {
    vscode.window.showErrorMessage("Session notepad is empty.");
    return;
  }

  const candidates = await collectMemoryBankMarkdownUris(folder.uri);
  let target: vscode.Uri | undefined;
  if (candidates.length === 0) {
    const create = await vscode.window.showWarningMessage(
      "No memory-bank/**/*.md found. Run Init memory bank first?",
      "Open init command help",
      "Cancel"
    );
    if (create === "Open init command help") {
      await vscode.commands.executeCommand("CloudeCodeToolBox.initMemoryBank");
    }
    return;
  }

  const pick = await vscode.window.showQuickPick(
    candidates.map((u) => ({
      label: vscode.workspace.asRelativePath(u, false),
      uri: u,
    })),
    { title: "Append session notepad to memory-bank file", placeHolder: "Pick target .md" }
  );
  if (!pick) {
    return;
  }
  target = pick.uri;

  let existing = "";
  try {
    existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(target)).trimEnd();
  } catch {
    vscode.window.showErrorMessage("Could not read target file.");
    return;
  }

  const stamp = `\n\n---\n\n## From session notepad — ${new Date().toISOString()}\n\n`;
  const proposed = `${existing}${stamp}${notepadText}\n`;

  const doc = await vscode.workspace.openTextDocument({
    content: proposed,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
  const ok = await vscode.window.showWarningMessage(
    "Apply append to disk on the chosen memory-bank file?",
    { modal: true },
    "Apply",
    "Cancel"
  );
  if (ok !== "Apply") {
    return;
  }
  const enc = new TextEncoder();
  await vscode.workspace.fs.writeFile(target, enc.encode(proposed));
  vscode.window.showInformationMessage(`Appended notepad to ${vscode.workspace.asRelativePath(target, false)}`);
}
