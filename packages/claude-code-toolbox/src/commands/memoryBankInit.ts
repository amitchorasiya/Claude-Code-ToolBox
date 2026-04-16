import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { runNpxInTerminal } from "../terminal/runNpx";

export type InitMemoryBankNpxOptions = {
  dryRun: boolean;
  cursorRules: boolean;
};

/** Init memory bank via npx without quick picks (One Click Setup). */
export function runInitMemoryBankWithOptions(
  folder: vscode.WorkspaceFolder,
  tag: string,
  opts: InitMemoryBankNpxOptions
): void {
  const flags: string[] = [];
  if (opts.dryRun) {
    flags.push("--dry-run");
  }
  if (opts.cursorRules) {
    flags.push("--cursor-rules");
  }
  const args = ["init", "--cwd", folder.uri.fsPath, ...flags];
  runNpxInTerminal(
    folder.uri.fsPath,
    "cloude-code-memory-bank",
    tag,
    args,
    "Memory bank (cloude-code-memory-bank)"
  );
}

export async function initMemoryBank(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const tag = mcpPaths.npxTag(cfg);

  const flags: string[] = [];

  /** Quick pick filters hide non-matching rows as the user types; keep both choices visible. */
  const dryPick = await vscode.window.showQuickPick(
    [
      {
        label: "Yes → real run",
        description: "Run init and write files",
        alwaysShow: true,
        value: false as const,
      },
      {
        label: "Yes (dry-run only)",
        description: "Preview in terminal; no files changed",
        alwaysShow: true,
        value: true as const,
      },
    ],
    { title: "Preview only (--dry-run)?", placeHolder: "Choose with ↑↓ or click" }
  );
  if (dryPick === undefined) {
    return;
  }
  if (dryPick.value) {
    flags.push("--dry-run");
  }

  const cursorRulesPick = await vscode.window.showQuickPick(
    [
      { label: "No", description: "CLAUDE.md + memory bank only", alwaysShow: true, value: false as const },
      { label: "Yes", description: "Also add .cursor/rules/*.mdc", alwaysShow: true, value: true as const },
    ],
    { title: "Also write Cursor .mdc rules? (--cursor-rules)", placeHolder: "Pick one" }
  );
  if (cursorRulesPick === undefined) {
    return;
  }
  if (cursorRulesPick.value) {
    flags.push("--cursor-rules");
  }

  runInitMemoryBankWithOptions(folder, tag, {
    dryRun: dryPick.value,
    cursorRules: cursorRulesPick.value,
  });
}
