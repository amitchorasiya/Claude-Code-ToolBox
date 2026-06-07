/**
 * Config change listener + confirmation modal for Safety Guards.
 */
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../../toolboxSettings";
import { runSafetyGuardsEnable, runSafetyGuardsDisable } from "./safetyGuardsCommand";

const ENABLED_KEY = `${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.enabled`;
const GLOBAL_ACK = "safetyGuardsActivationAcknowledged";

export function registerSafetyGuardsActivation(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration(ENABLED_KEY)) {
      return;
    }
    const cfg = vscode.workspace.getConfiguration();
    if (cfg.get<boolean>(ENABLED_KEY) !== true) {
      await context.globalState.update(GLOBAL_ACK, false);
      await runSafetyGuardsDisable();
      return;
    }
    if (context.globalState.get(GLOBAL_ACK) !== true) {
      const choice = await vscode.window.showInformationMessage(
        "Safety Guards — activate?",
        {
          modal: true,
          detail:
            "This will install Claude Code hooks that:\n\n" +
            "• Block or warn on destructive commands (rm -rf, git push --force, DROP TABLE, etc.)\n" +
            "• Enforce domain whitelisting for web requests (blocks exfiltration to unknown domains)\n\n" +
            "Default patterns are pre-configured. You can customize patterns and domains in Settings.\n" +
            "Disable anytime to remove all hooks.",
        },
        "Activate"
      );

      if (choice === "Activate") {
        await context.globalState.update(GLOBAL_ACK, true);
        await runSafetyGuardsEnable();
      } else {
        await revertEnabledFalse();
      }
      return;
    }

    await runSafetyGuardsEnable();
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

export async function safetyGuardsStartupCheck(
  context: vscode.ExtensionContext
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  if (cfg.get<boolean>(ENABLED_KEY) !== true) {
    return;
  }
  if (context.globalState.get(GLOBAL_ACK) === true) {
    return;
  }
  const choice = await vscode.window.showInformationMessage(
    "Safety Guards — activate?",
    {
      modal: true,
      detail:
        "Safety Guards is enabled but not yet activated.\n\n" +
        "This will install hooks to block destructive commands and enforce " +
        "domain whitelisting for web requests.\n\n" +
        "Disable anytime to remove all hooks.",
    },
    "Activate"
  );
  if (choice === "Activate") {
    await context.globalState.update(GLOBAL_ACK, true);
    await runSafetyGuardsEnable();
  } else {
    await revertEnabledFalse();
  }
}
