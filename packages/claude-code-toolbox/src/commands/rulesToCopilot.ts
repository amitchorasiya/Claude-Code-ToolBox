import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { runNpxInTerminal } from "../terminal/runNpx";

/** Sync Cursor rules without quick picks (One Click Setup). */
export function runSyncCursorRulesWithOptions(
  folder: vscode.WorkspaceFolder,
  tag: string,
  dryRun: boolean
): void {
  const args = ["--cwd", folder.uri.fsPath];
  if (dryRun) {
    args.push("--dry-run");
  }
  runNpxInTerminal(
    folder.uri.fsPath,
    "cursor-rules-to-claude",
    tag,
    args,
    "Cursor rules → CLAUDE.md"
  );
}

export async function syncCursorRules(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const tag = mcpPaths.npxTag(cfg);

  const pick = await vscode.window.showQuickPick(
    [
      { label: "Run (write CLAUDE.md + .claude/rules)", value: "run" as const },
      { label: "Dry run (preview only)", value: "dry" as const },
    ],
    { title: "Sync Cursor rules → Claude project files" }
  );
  if (!pick) {
    return;
  }

  runSyncCursorRulesWithOptions(folder, tag, pick.value === "dry");
}
