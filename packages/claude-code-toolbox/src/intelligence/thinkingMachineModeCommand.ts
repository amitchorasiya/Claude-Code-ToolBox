import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { showMcpSkillsAwareness } from "./mcpSkillsAwarenessCommand";
import { runContextPackDelivery } from "./contextPackCommand";
import { TOOLBOX_SETTINGS_PREFIX } from "../toolboxSettings";

const CFG = `${TOOLBOX_SETTINGS_PREFIX}.thinkingMachineMode`;

function cfgBool(config: vscode.WorkspaceConfiguration, key: string, fallback: boolean): boolean {
  const v = config.get<boolean>(`${CFG}.${key}`);
  return v === undefined ? fallback : v;
}

function resolveContextPackFlags(config: vscode.WorkspaceConfiguration): {
  includeGit: boolean;
  includeDiagnostics: boolean;
  appendNotepad: boolean;
  openChat: boolean;
} {
  if (cfgBool(config, "useSeparateContextPackDefaults", false)) {
    return {
      includeGit: cfgBool(config, "includeGit", false),
      includeDiagnostics: cfgBool(config, "includeDiagnostics", false),
      appendNotepad: cfgBool(config, "appendNotepad", false),
      openChat: cfgBool(config, "openChat", true),
    };
  }
  const ig = config.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.intelligence.includeGitByDefault`);
  const id = config.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.intelligence.includeDiagnosticsByDefault`);
  const ap = config.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.intelligence.appendNotepadAfterPack`);
  const oc = config.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.intelligence.openChatAfterPack`);
  return {
    includeGit: ig === undefined ? false : ig,
    includeDiagnostics: id === undefined ? false : id,
    appendNotepad: ap === undefined ? false : ap,
    openChat: oc === undefined ? false : oc,
  };
}

/**
 * One gesture: optional MCP/skills awareness (writes .claude) + context pack + optional Claude Code.
 */
export async function runThinkingMachinePriming(context: vscode.ExtensionContext): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const config = vscode.workspace.getConfiguration();
  if (cfgBool(config, "enabled", false) !== true) {
    vscode.window.showWarningMessage(
      "Thinking Machine Mode is off. Enable it under Settings → Thinking Machine Mode, then try again."
    );
    return;
  }

  const runScan = cfgBool(config, "runAwarenessScan", true);
  const mergeBlock = cfgBool(config, "mergeAwarenessIntoClaudeMd", true);
  const showPre = cfgBool(config, "showConfirmationModal", true);

  if (showPre) {
    const writes = runScan;
    const detail = writes
      ? "This may write or update files under `.claude/` and `CLAUDE.md` (MCP & Skills awareness + merge), copy a context pack to the clipboard, and open Claude Code if configured. Use **One Click Setup** beforehand when migrating from Cursor or GitHub Copilot."
      : "This copies a context pack to the clipboard and may open Claude Code. No MCP/skills scan is configured.";
    const ok = await vscode.window.showWarningMessage(
      "Run Thinking Machine priming?",
      { modal: true, detail },
      "Continue"
    );
    if (ok !== "Continue") {
      return;
    }
  }

  const pack = resolveContextPackFlags(config);

  if (runScan) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Thinking Machine priming: MCP & Skills awareness…",
        cancellable: false,
      },
      async () => {
        await showMcpSkillsAwareness(context, {
          silentNotification: true,
          forceMergeIntoInstructions: mergeBlock,
        });
      }
    );
  }

  await runContextPackDelivery(folder, {
    ...pack,
    showCompletionMessage: false,
  });

  const next = await vscode.window.showInformationMessage(
    "Thinking Machine priming finished. Context pack is on the clipboard. Paste into Claude Code.",
    "Tune Thinking Machine Mode",
    "Custom context pack…"
  );
  if (next === "Tune Thinking Machine Mode") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.openThinkingMachineModeSettings");
  } else if (next === "Custom context pack…") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.buildContextPack");
  }
}
