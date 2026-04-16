import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { mergeCopilotInstructionsIntoClaudeMdContent } from "./mergeCopilotInstructionsCore";

const COPILOT_REL = ".github/copilot-instructions.md";

/**
 * Reads `.github/copilot-instructions.md` and merges into root `CLAUDE.md` (replaceable HTML-comment block).
 * No-op if the Copilot file is missing or empty.
 */
export async function mergeCopilotInstructionsIntoClaudeMd(): Promise<boolean> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return false;
  }

  const copilotUri = vscode.Uri.joinPath(folder.uri, ".github", "copilot-instructions.md");
  let copilotText: string;
  try {
    const buf = await vscode.workspace.fs.readFile(copilotUri);
    copilotText = new TextDecoder().decode(buf).trim();
  } catch {
    return false;
  }

  if (!copilotText) {
    return false;
  }

  const claudeUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(claudeUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    /* new file */
  }

  const next = mergeCopilotInstructionsIntoClaudeMdContent(existing, copilotText);
  await vscode.workspace.fs.writeFile(claudeUri, new TextEncoder().encode(next));
  return true;
}

export async function mergeCopilotInstructionsIntoClaudeMdSilent(folder: vscode.WorkspaceFolder): Promise<boolean> {
  const copilotUri = vscode.Uri.joinPath(folder.uri, ".github", "copilot-instructions.md");
  let copilotText: string;
  try {
    const buf = await vscode.workspace.fs.readFile(copilotUri);
    copilotText = new TextDecoder().decode(buf).trim();
  } catch {
    return false;
  }
  if (!copilotText) {
    return false;
  }
  const claudeUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(claudeUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    /* new */
  }
  const next = mergeCopilotInstructionsIntoClaudeMdContent(existing, copilotText);
  await vscode.workspace.fs.writeFile(claudeUri, new TextEncoder().encode(next));
  return true;
}

export function copilotInstructionsRelativePath(): string {
  return COPILOT_REL;
}

export async function runMergeCopilotInstructionsIntoClaudeMdCommand(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  const ok = await mergeCopilotInstructionsIntoClaudeMd();
  if (ok && folder) {
    const claudeUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
    await vscode.window.showTextDocument(claudeUri, { preview: true });
    await vscode.window.showInformationMessage("Merged .github/copilot-instructions.md into CLAUDE.md.");
  } else if (!ok) {
    await vscode.window.showInformationMessage(
      "Nothing merged: .github/copilot-instructions.md is missing or empty."
    );
  }
}
