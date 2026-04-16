import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../toolboxSettings";
import { showMcpSkillsAwareness } from "./mcpSkillsAwarenessCommand";
import { cascadeThinkingMachineChildSettingsToTrue } from "./thinkingMachineModeCascade";

const RUN_AWARENESS_SCAN_KEY = `${TOOLBOX_SETTINGS_PREFIX}.thinkingMachineMode.runAwarenessScan`;
const MERGE_AWARENESS_KEY = `${TOOLBOX_SETTINGS_PREFIX}.thinkingMachineMode.mergeAwarenessIntoClaudeMd`;

const ENABLED_KEY = `${TOOLBOX_SETTINGS_PREFIX}.thinkingMachineMode.enabled`;
const GLOBAL_ACK = "thinkingMachineModeActivationAcknowledged";
const MIGRATION_TOAST = "thinkingMachineAutoScanDefaultMigration0529";

/**
 * After cascade turns child prefs on, persist MCP & Skills awareness when that sub-setting is enabled.
 * Matches user expectation that turning Thinking Machine Mode back on restores `.claude/cloude-code-toolbox-mcp-skills-awareness.md`.
 */
async function runThinkingMachineAwarenessAfterCascade(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  if (cfg.get<boolean>(RUN_AWARENESS_SCAN_KEY) !== true) {
    return;
  }
  const mergeBlock = cfg.get<boolean>(MERGE_AWARENESS_KEY) === true;
  await showMcpSkillsAwareness(context, {
    silentNotification: true,
    forceMergeIntoInstructions: mergeBlock,
  });
  void vscode.commands.executeCommand("CloudeCodeToolBox.refreshMcpView");
}

/**
 * When Thinking Machine Mode is enabled, show the Engage modal until acknowledged; each time the user turns
 * the mode off, acknowledgment is cleared so turning it back on shows the modal again.
 */
export function registerThinkingMachineModeActivation(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (!e.affectsConfiguration(ENABLED_KEY)) {
      return;
    }
    const cfg = vscode.workspace.getConfiguration();
    if (cfg.get<boolean>(ENABLED_KEY) !== true) {
      // Turning the mode off clears acknowledgment so the next enable shows Engage again.
      await context.globalState.update(GLOBAL_ACK, false);
      return;
    }
    if (context.globalState.get(GLOBAL_ACK) !== true) {
      const choice = await vscode.window.showInformationMessage(
        "Thinking Machine Mode — initialize neural link?",
        {
          modal: true,
          detail:
            "We’ll align your workspace context — MCP server ids, skills layout, open-editor snapshots, and `CLAUDE.md` merge blocks — so Claude Code can start sharper in this repo.\n\n" +
            "This is file-backed priming (reports + clipboard context pack), not a hidden code index. For deep repo work, use Claude Code exploration and `/mcp` as needed. Run **One Click Setup** first if you are migrating from Cursor or GitHub Copilot.",
        },
        "Engage"
      );

      if (choice === "Engage") {
        await context.globalState.update(GLOBAL_ACK, true);
        await cascadeThinkingMachineChildSettingsToTrue();
        await runThinkingMachineAwarenessAfterCascade(context);
      } else {
        await revertThinkingMachineEnabledFalse();
      }
      return;
    }

    await cascadeThinkingMachineChildSettingsToTrue();
    await runThinkingMachineAwarenessAfterCascade(context);
  });
}

async function revertThinkingMachineEnabledFalse(): Promise<void> {
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

/**
 * If settings already have Thinking Machine enabled but the user never confirmed Engage, prompt once per session startup.
 */
export async function thinkingMachineModeActivationStartupCheck(
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
    "Thinking Machine Mode — initialize neural link?",
    {
      modal: true,
      detail:
        "We’ll align your workspace context — MCP server ids, skills layout, open-editor snapshots, and `CLAUDE.md` merge blocks — so Claude Code can start sharper in this repo.\n\n" +
        "This is file-backed priming (reports + clipboard context pack), not a hidden code index. For deep repo work, use Claude Code exploration and `/mcp` as needed. Run **One Click Setup** first if you are migrating from Cursor or GitHub Copilot.",
    },
    "Engage"
  );
  if (choice === "Engage") {
    await context.globalState.update(GLOBAL_ACK, true);
    await cascadeThinkingMachineChildSettingsToTrue();
    await runThinkingMachineAwarenessAfterCascade(context);
  } else {
    await revertThinkingMachineEnabledFalse();
  }
}

/**
 * One-time toast after upgrade: auto-scan default is now true.
 */
export async function maybeShowAutoScanDefaultMigrationToast(
  context: vscode.ExtensionContext
): Promise<void> {
  if (context.globalState.get(MIGRATION_TOAST) === true) {
    return;
  }
  await context.globalState.update(MIGRATION_TOAST, true);
  const choice = await vscode.window.showInformationMessage(
    "Cloude Code ToolBox: background MCP & Skills auto-scan now defaults to ON (saves under `.claude/` on workspace open). Turn it off under Settings → MCP & Skills — background sync if you prefer manual scans only.",
    "Open settings"
  );
  if (choice === "Open settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen"
    );
  }
}
