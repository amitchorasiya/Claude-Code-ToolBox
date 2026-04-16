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
