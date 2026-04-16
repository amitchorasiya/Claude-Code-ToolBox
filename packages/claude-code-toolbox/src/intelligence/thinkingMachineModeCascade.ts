import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../toolboxSettings";

const ENABLED_KEY = `${TOOLBOX_SETTINGS_PREFIX}.thinkingMachineMode.enabled`;

const CHILD_SETTING_KEYS = [
  "thinkingMachineMode.runAwarenessScan",
  "thinkingMachineMode.mergeAwarenessIntoClaudeMd",
  "thinkingMachineMode.showConfirmationModal",
  "thinkingMachineMode.useSeparateContextPackDefaults",
  "thinkingMachineMode.includeGit",
  "thinkingMachineMode.includeDiagnostics",
  "thinkingMachineMode.appendNotepad",
  "thinkingMachineMode.openChat",
] as const;

/**
 * When Thinking Machine Mode is enabled, set all other booleans in that group to true
 * at the same configuration target as the master switch.
 */
export async function cascadeThinkingMachineChildSettingsToTrue(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  if (cfg.get<boolean>(ENABLED_KEY) !== true) {
    return;
  }

  const ins = cfg.inspect(ENABLED_KEY);
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (ins?.workspaceFolderValue === true && folder) {
    const scoped = vscode.workspace.getConfiguration(TOOLBOX_SETTINGS_PREFIX, folder.uri);
    for (const k of CHILD_SETTING_KEYS) {
      await scoped.update(k, true, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    return;
  }

  if (ins?.workspaceValue === true) {
    const scoped = vscode.workspace.getConfiguration(TOOLBOX_SETTINGS_PREFIX);
    for (const k of CHILD_SETTING_KEYS) {
      await scoped.update(k, true, vscode.ConfigurationTarget.Workspace);
    }
    return;
  }

  if (ins?.globalValue === true) {
    const scoped = vscode.workspace.getConfiguration(TOOLBOX_SETTINGS_PREFIX);
    for (const k of CHILD_SETTING_KEYS) {
      await scoped.update(k, true, vscode.ConfigurationTarget.Global);
    }
    return;
  }

  const scoped = vscode.workspace.getConfiguration(TOOLBOX_SETTINGS_PREFIX);
  const target =
    (vscode.workspace.workspaceFolders?.length ?? 0) > 0
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
  for (const k of CHILD_SETTING_KEYS) {
    await scoped.update(k, true, target);
  }
}
