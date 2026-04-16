import * as vscode from "vscode";

/**
 * Legacy “workspace wizard” entry: Cursor → Copilot setup is **One Click Setup** (configurable steps).
 * The old four-step wizard duplicated those bridges; we delegate here.
 */
export async function workspaceSetupWizard(): Promise<void> {
  const next = await vscode.window.showInformationMessage(
    "Cursor → Copilot setup uses **One Click Setup** (configure steps under Settings → One Click Setup).",
    { modal: false },
    "Run One Click Setup",
    "Open One Click settings"
  );
  if (next === "Run One Click Setup") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.runOneClickSetup");
  } else if (next === "Open One Click settings") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.openOneClickSetupSettings");
  }
}
