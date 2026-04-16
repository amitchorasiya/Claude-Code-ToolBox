import * as vscode from "vscode";

export async function openThinkingMachineModeSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "cloude-code-toolbox.thinkingMachineMode"
  );
}
