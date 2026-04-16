import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "./toolboxSettings";

const P = `${TOOLBOX_SETTINGS_PREFIX}.oneClickSetup`;

type InspectKey = "globalValue" | "workspaceValue";

function slice(cfg: vscode.WorkspaceConfiguration, suffix: string, key: InspectKey): unknown {
  return cfg.inspect(`${P}.${suffix}`)?.[key];
}

/**
 * Migrates pre-0.5.15 One Click boolean pairs into single enum settings (per User / Workspace scope).
 */
export async function migrateOneClickSetupToNewKeys(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  await migrateForTarget(cfg, vscode.ConfigurationTarget.Global, "globalValue");
  await migrateForTarget(cfg, vscode.ConfigurationTarget.Workspace, "workspaceValue");
}

async function migrateForTarget(
  cfg: vscode.WorkspaceConfiguration,
  target: vscode.ConfigurationTarget,
  ik: InspectKey
): Promise<void> {
  const gv = (s: string): unknown => slice(cfg, s, ik);

  if (gv("initMemoryBankMode") === undefined) {
    const init = gv("initMemoryBank");
    const dry = gv("initMemoryBankDryRun");
    const legacyForce = gv("initMemoryBankForce");
    if (init !== undefined || dry !== undefined || legacyForce !== undefined) {
      const effectiveInit = init !== false;
      let mode: string;
      if (!effectiveInit) {
        mode = "off";
      } else if (dry === true) {
        mode = "dryRun";
      } else {
        mode = "apply";
      }
      await cfg.update(`${P}.initMemoryBankMode`, mode, target);
      for (const k of ["initMemoryBank", "initMemoryBankDryRun", "initMemoryBankForce"] as const) {
        await cfg.update(`${P}.${k}`, undefined, target);
      }
    }
  }

  if (gv("syncCursorRulesMode") === undefined) {
    const sync = gv("syncCursorRules");
    const dry = gv("syncCursorRulesDryRun");
    if (sync !== undefined || dry !== undefined) {
      const effectiveSync = sync !== false;
      const mode = !effectiveSync ? "off" : dry === true ? "dryRun" : "apply";
      await cfg.update(`${P}.syncCursorRulesMode`, mode, target);
      await cfg.update(`${P}.syncCursorRules`, undefined, target);
      await cfg.update(`${P}.syncCursorRulesDryRun`, undefined, target);
    }
  }

  if (gv("migrateSkillsTarget") === undefined) {
    const migrateOn = gv("migrateSkills");
    const scope = gv("migrateSkillsScope");
    if (migrateOn !== undefined || scope !== undefined) {
      const on = migrateOn === true;
      const sc = typeof scope === "string" && ["workspace", "user", "both"].includes(scope) ? scope : "workspace";
      const val = on ? sc : "off";
      await cfg.update(`${P}.migrateSkillsTarget`, val, target);
      await cfg.update(`${P}.migrateSkills`, undefined, target);
      await cfg.update(`${P}.migrateSkillsScope`, undefined, target);
    }
  }

  if (gv("instructionMergeAfterOneClick") === undefined) {
    const turnOn = gv("turnOnAutoScanAfter");
    const mergeOnce = gv("mergeInstructionsWithoutAutoScan");
    if (turnOn !== undefined || mergeOnce !== undefined) {
      const effectiveTurnOn = turnOn !== false;
      let policy: string;
      if (effectiveTurnOn) {
        policy = "enableAutoScan";
      } else if (mergeOnce === true) {
        policy = "mergeClaudeMdOnce";
      } else {
        policy = "leaveUnchanged";
      }
      await cfg.update(`${P}.instructionMergeAfterOneClick`, policy, target);
      await cfg.update(`${P}.turnOnAutoScanAfter`, undefined, target);
      await cfg.update(`${P}.mergeInstructionsWithoutAutoScan`, undefined, target);
    }
  }

  /** Legacy enum values removed in favor of merge-only behavior. */
  const port = gv("portCursorMcp");
  if (port === "workspaceOverwrite") {
    await cfg.update(`${P}.portCursorMcp`, "workspaceMerge", target);
  }
  const imb = gv("initMemoryBankMode");
  if (imb === "applyForce") {
    await cfg.update(`${P}.initMemoryBankMode`, "apply", target);
  }
}
