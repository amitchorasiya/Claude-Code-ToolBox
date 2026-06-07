/**
 * VSCode wrapper: merges Token Optimization block into CLAUDE.md.
 */
import * as vscode from "vscode";
import {
  buildTokenOptInstructionsBlock,
  replaceOrAppendTokenOptBlock,
  removeTokenOptBlock,
} from "./mergeTokenOptIntoClaudeMdCore";

export {
  TOKEN_OPT_BANNER_START,
  TOKEN_OPT_BANNER_END,
  buildTokenOptInstructionsBlock,
  replaceOrAppendTokenOptBlock,
  removeTokenOptBlock,
} from "./mergeTokenOptIntoClaudeMdCore";

export async function mergeTokenOptIntoClaudeMd(
  folder: vscode.WorkspaceFolder,
  innerMarkdown: string
): Promise<void> {
  const outUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
  const block = buildTokenOptInstructionsBlock(innerMarkdown);

  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(outUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    /* new file */
  }

  const next = replaceOrAppendTokenOptBlock(existing, block);
  await vscode.workspace.fs.writeFile(outUri, new TextEncoder().encode(next));
}

export async function removeTokenOptFromClaudeMd(
  folder: vscode.WorkspaceFolder
): Promise<void> {
  const outUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");

  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(outUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    return;
  }

  const next = removeTokenOptBlock(existing);
  await vscode.workspace.fs.writeFile(outUri, new TextEncoder().encode(next));
}
