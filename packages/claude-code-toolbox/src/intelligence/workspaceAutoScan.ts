import * as vscode from "vscode";

const SETTING = "cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen";
const DEBOUNCE_MS = 1200;

/**
 * When the setting is on and at least one workspace folder is open, runs `run` after a short delay.
 * Triggers on activation (if a folder is already open) and when folders are added.
 */
export function registerMcpSkillsAutoScanOnWorkspaceOpen(
  context: vscode.ExtensionContext,
  run: () => void | Promise<void>
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (): void => {
    const cfg = vscode.workspace.getConfiguration();
    if (cfg.get<boolean>(SETTING) !== true) {
      return;
    }
    if (!vscode.workspace.workspaceFolders?.length) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, DEBOUNCE_MS);
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      if (e.added.length > 0) {
        schedule();
      }
    })
  );

  schedule();
}
