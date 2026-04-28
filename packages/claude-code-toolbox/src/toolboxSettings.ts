import * as vscode from "vscode";

export const TOOLBOX_SETTINGS_PREFIX = "cloude-code-toolbox";

/** Prior settings namespaces (base64 avoids embedding deprecated product names in source). */
const LEGACY_SETTING_PREFIXES: readonly string[] = [
  Buffer.from("Y29waWxvdC10b29sYm94", "base64").toString("utf8"),
  Buffer.from("R2l0SHViQ29waWxvdFRvb2xCb3g=", "base64").toString("utf8"),
];

const MIGRATE_SUFFIXES: readonly string[] = [
  "npxTag",
  "useInsidersPaths",
  "intelligence.includeGitByDefault",
  "intelligence.includeDiagnosticsByDefault",
  "intelligence.appendNotepadAfterPack",
  "intelligence.openChatAfterPack",
  "intelligence.autoScanMcpSkillsOnWorkspaceOpen",
  "oneClickSetup.settingsScope",
  "oneClickSetup.portCursorMcp",
  "oneClickSetup.syncCursorRules",
  "oneClickSetup.syncCursorRulesDryRun",
  "oneClickSetup.initMemoryBank",
  "oneClickSetup.initMemoryBankDryRun",
  "oneClickSetup.initMemoryBankCursorRules",
  "oneClickSetup.initMemoryBankForce",
  "oneClickSetup.appendCursorrules",
  "oneClickSetup.turnOnAutoScanAfter",
  "oneClickSetup.mergeInstructionsWithoutAutoScan",
  "oneClickSetup.runAwarenessScan",
  "oneClickSetup.runReadiness",
  "oneClickSetup.runConfigScan",
  "oneClickSetup.runFirstTestTask",
  "oneClickSetup.migrateSkills",
  "oneClickSetup.migrateSkillsScope",
  "oneClickSetup.migrateSkillsMode",
  "translateWrapMultilineInFence",
  "agentTeams.enabled",
  "agentTeams.defaultModel",
  "agentTeams.defaultProtocol",
  "agentTeams.claudeBinOverride",
  "agentTeams.maxConcurrentAgents",
  "agentTeams.costCapUsd",
  "agentDashboard.enabled",
  "agentDashboard.hookPort",
  "agentDashboard.includeInternalRuns",
  "agentDashboard.retainDoneCardsMs",
  "agentDashboard.autoPairPlanningPrompts",
  "agentDashboard.defaultPairTeamName",
  "agentDashboard.safetyAlerts",
  "agentDashboard.safetyPatterns",
];

export async function migrateLegacyToolboxSettings(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  for (const legacyPrefix of LEGACY_SETTING_PREFIXES) {
    for (const suffix of MIGRATE_SUFFIXES) {
      const oldKey = `${legacyPrefix}.${suffix}`;
      const newKey = `${TOOLBOX_SETTINGS_PREFIX}.${suffix}`;
      const n = cfg.inspect(newKey);
      const o = cfg.inspect(oldKey);
      if (!o) {
        continue;
      }
      if (o.workspaceValue !== undefined && n?.workspaceValue === undefined) {
        await cfg.update(newKey, o.workspaceValue, vscode.ConfigurationTarget.Workspace);
        await cfg.update(oldKey, undefined, vscode.ConfigurationTarget.Workspace);
      }
      if (o.globalValue !== undefined && n?.globalValue === undefined) {
        await cfg.update(newKey, o.globalValue, vscode.ConfigurationTarget.Global);
        await cfg.update(oldKey, undefined, vscode.ConfigurationTarget.Global);
      }
    }
  }
}

export function affectsToolboxSetting(
  e: vscode.ConfigurationChangeEvent,
  settingRelativeKey: string
): boolean {
  if (e.affectsConfiguration(`${TOOLBOX_SETTINGS_PREFIX}.${settingRelativeKey}`)) {
    return true;
  }
  return LEGACY_SETTING_PREFIXES.some((p) =>
    e.affectsConfiguration(`${p}.${settingRelativeKey}`)
  );
}

/**
 * Write a `cloude-code-toolbox.*` setting but tolerate VS Code reporting
 * "is not a registered configuration" — that happens when the running
 * extension's JS is newer than its installed `package.json` manifest
 * (stale reload). We swallow the error so the feature flow still completes;
 * the state is recomputed from disk on the next reload anyway.
 */
export async function safeUpdateToolboxSetting(
  relativeKey: string,
  value: unknown,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration();
  try {
    await cfg.update(`${TOOLBOX_SETTINGS_PREFIX}.${relativeKey}`, value, target);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not a registered configuration/i.test(msg)) {
      console.warn(
        `[Claude Code ToolBox] setting "${relativeKey}" not registered; skipping persist. Reload the window after updating the extension.`
      );
      return false;
    }
    throw e;
  }
}
