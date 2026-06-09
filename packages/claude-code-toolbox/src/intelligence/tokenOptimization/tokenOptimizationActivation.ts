/**
 * Config change listener + confirmation modal for Token Optimization.
 */
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../../toolboxSettings";
import { runTokenOptimizationEnable, runTokenOptimizationDisable } from "./tokenOptimizationCommand";

const ENABLED_KEY = `${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.enabled`;
const GLOBAL_ACK = "tokenOptimizationActivationAcknowledged";

export function registerTokenOptimizationActivation(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration(ENABLED_KEY)) {
      return;
    }
    const cfg = vscode.workspace.getConfiguration();
    if (cfg.get<boolean>(ENABLED_KEY) !== true) {
      await context.globalState.update(GLOBAL_ACK, false);
      await runTokenOptimizationDisable();
      return;
    }
    if (context.globalState.get(GLOBAL_ACK) !== true) {
      const choice = await vscode.window.showInformationMessage(
        "Token Optimization — activate?",
        {
          modal: true,
          detail:
            "This will:\n" +
            "• Merge concise-mode instructions into CLAUDE.md\n" +
            "• Generate a project dependency map (.claude/project-map.md)\n" +
            "• Install hooks for read deduplication, .claudeignore, and output compression\n" +
            "• Enable context budget alerts\n\n" +
            "All changes are reversible via Disable. Hooks never block Claude — they advise only.",
        },
        "Activate"
      );

      if (choice === "Activate") {
        await context.globalState.update(GLOBAL_ACK, true);
        await runTokenOptimizationEnable();
      } else {
        await revertEnabledFalse();
      }
      return;
    }

    await runTokenOptimizationEnable();
  });
}

async function revertEnabledFalse(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const ins = cfg.inspect(ENABLED_KEY);
  if (ins?.workspaceFolderValue === true) {
    await cfg.update(ENABLED_KEY, false, vscode.ConfigurationTarget.WorkspaceFolder);
  }
  if (ins?.workspaceValue === true) {
    await cfg.update(ENABLED_KEY, false, vscode.ConfigurationTarget.Workspace);
  }
  if (ins?.globalValue === true) {
    await cfg.update(ENABLED_KEY, false, vscode.ConfigurationTarget.Global);
  }
}

export async function tokenOptimizationStartupCheck(
  context: vscode.ExtensionContext
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  if (cfg.get<boolean>(ENABLED_KEY) !== true) {
    return;
  }
  if (context.globalState.get(GLOBAL_ACK) === true) {
    await runTokenOptimizationEnable();
    await maybeAutoGenerateProjectMap(cfg);
    return;
  }
  const choice = await vscode.window.showInformationMessage(
    "Token Optimization — activate?",
    {
      modal: true,
      detail:
        "Token Optimization is enabled but not yet activated.\n\n" +
        "This will merge instructions into CLAUDE.md, generate a project map, " +
        "and install hooks for read deduplication and output compression.\n\n" +
        "All changes are reversible via Disable.",
    },
    "Activate"
  );
  if (choice === "Activate") {
    await context.globalState.update(GLOBAL_ACK, true);
    await runTokenOptimizationEnable();
  } else {
    await revertEnabledFalse();
  }
}

async function maybeAutoGenerateProjectMap(
  cfg: vscode.WorkspaceConfiguration
): Promise<void> {
  const projectMapEnabled = cfg.get<boolean>(
    `${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.projectMap.enabled`,
    true
  );
  if (!projectMapEnabled) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;

  const { runGenerateProjectMap } = await import("./tokenOptimizationCommand");
  await runGenerateProjectMap();
}
