import * as os from "node:os";
import * as vscode from "vscode";
import { appendCursorrules } from "./migrateCursorrules";
import {
  runInitMemoryBankBundledWithOptions,
  runPortCursorMcpBundledWithMode,
  runSyncCursorRulesBundledWithOptions,
} from "./bridgeWithoutNpx";
import type { PortCursorMcpMode } from "./portFromCursor";
import * as mcpPaths from "../mcpPaths";
import { portVsCodeMcpToClaudeCode } from "../claudeCodeMcp";
import { showMcpSkillsAwareness } from "../intelligence/mcpSkillsAwarenessCommand";
import { showIntelligenceReadiness } from "../intelligence/readinessCommand";
import { runClaudeToolboxConfigScan } from "./claudeToolboxConfigScan";
import { runFirstWorkspaceTestTask } from "./runFirstTestTask";
import type { MigrateSkillMode } from "../skills/migrateCursorSkillsToAgents";
import {
  runCopilotGithubSkillsMigrationForRoot,
  runCopilotUserSkillsMigrationForRoot,
  runMigrationForRoot,
} from "../skills/migrateCursorSkillsToAgents";
import { mergeCopilotInstructionsIntoClaudeMdSilent } from "./mergeCopilotInstructionsIntoClaudeMd";
import { TOOLBOX_SETTINGS_PREFIX } from "../toolboxSettings";

const CFG = TOOLBOX_SETTINGS_PREFIX;

type OneClickSkillsTarget = "off" | "workspace" | "user" | "both";
type OneClickSkillsMode = "copy" | "move";
type OneClickMemoryBankMode = "apply" | "dryRun" | "off";
type OneClickRulesMode = "apply" | "dryRun" | "off";
type OneClickInstructionMergePolicy = "enableAutoScan" | "mergeClaudeMdOnce" | "leaveUnchanged";

function pickEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
  notes: string[],
  label: string
): T {
  if (raw && allowed.includes(raw as T)) {
    return raw as T;
  }
  if (raw && raw !== fallback) {
    notes.push(`[One Click] ${label}: "${raw}" is legacy/invalid; using "${fallback}" (merge-safe).`);
  }
  return fallback;
}

function cfgScope(): vscode.ConfigurationTarget {
  const s = vscode.workspace
    .getConfiguration()
    .get<string>(`${CFG}.oneClickSetup.settingsScope`, "workspace");
  return s === "user" ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace;
}

function getPortMode(notes: string[]): PortCursorMcpMode | "skip" {
  const v = vscode.workspace
    .getConfiguration()
    .get<string>(`${CFG}.oneClickSetup.portCursorMcp`, "claude");
  if (v === "skip" || v === "dry") {
    return v === "dry" ? "dry" : "skip";
  }
  if (v === "workspaceOverwrite" || v === "workspaceMerge") {
    if (v === "workspaceOverwrite") {
      notes.push('[One Click] portCursorMcp "workspaceOverwrite" downgraded to merge-only workspace mode.');
    }
    return "workspace";
  }
  if (v === "claude" || v === "claudeProject" || v === "user" || v === "workspace") {
    return v as PortCursorMcpMode;
  }
  notes.push(`[One Click] portCursorMcp "${String(v)}" is invalid; using "claude" (Claude Code default).`);
  return "claude";
}

export async function openOneClickSetupSettings(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.openSettings", `${CFG}.oneClickSetup`);
}

/**
 * Order: **Cursor track** (skills, rules, cursorrules, MCP port) → **Copilot track** (instructions merge, Copilot skills) → **shared** memory bank → follow-ups.
 * Memory bank runs after instruction merges so `CLAUDE.md` picks up Cursor + Copilot text before `cloude-code-memory-bank` adjusts it.
 */
export async function runOneClickSetup(
  context: vscode.ExtensionContext,
  refreshHub: () => void,
): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    "One Click Setup will run the automated steps you configured (bundled Node CLIs — no npx, file merges, scans). " +
      "You are responsible for reviewing every change and your repo. Secrets or wrong targets can cause data loss. Continue?",
    {
      modal: true,
      detail:
        "Adjust **Migration tracks** and sub-steps under Settings → Cloude Code ToolBox → One Click Setup.\n\n" +
        "Both **Cursor → Claude Code** and **GitHub Copilot → Claude Code** tracks default to ON; turn either off if you only need one path.\n\n" +
        "Install the Claude Code extension and sign in. VS Code `mcp.json` and Claude Code `/mcp` are separate.",
    },
    "I understand — run setup"
  );
  if (confirm !== "I understand — run setup") {
    return;
  }

  const ws = vscode.workspace.getConfiguration();
  const notes: string[] = [];
  const qm = { quietMissing: true } as const;
  const scope = cfgScope();

  const migrateFromCursor = ws.get<boolean>(`${CFG}.oneClickSetup.migrateFromCursor`, true);
  const migrateFromGitHubCopilot = ws.get<boolean>(`${CFG}.oneClickSetup.migrateFromGitHubCopilot`, true);

  const skillsTarget = pickEnum<OneClickSkillsTarget>(
    ws.get<string>(`${CFG}.oneClickSetup.migrateSkillsTarget`, "off"),
    ["off", "workspace", "user", "both"],
    "off",
    notes,
    "migrateSkillsTarget"
  );
  const migrateCursorSkills = migrateFromCursor && skillsTarget !== "off";
  const migrateCursorScope = (migrateCursorSkills ? skillsTarget : "workspace") as "workspace" | "user" | "both";
  const migrateMode = pickEnum<OneClickSkillsMode>(
    ws.get<string>(`${CFG}.oneClickSetup.migrateSkillsMode`, "copy"),
    ["copy", "move"],
    "copy",
    notes,
    "migrateSkillsMode"
  ) as MigrateSkillMode;

  const rawInitMb = ws.get<string>(`${CFG}.oneClickSetup.initMemoryBankMode`, "apply");
  if (rawInitMb === "applyForce") {
    notes.push('[One Click] initMemoryBankMode "applyForce" downgraded to "apply" (merge-safe).');
  }
  const initMemoryBankMode = pickEnum<OneClickMemoryBankMode>(
    rawInitMb === "applyForce" ? "apply" : rawInitMb,
    ["apply", "dryRun", "off"],
    "apply",
    notes,
    "initMemoryBankMode"
  );
  const initMb = initMemoryBankMode !== "off";
  const initMbDry = initMemoryBankMode === "dryRun";
  const initMbCursor =
    migrateFromCursor && ws.get<boolean>(`${CFG}.oneClickSetup.initMemoryBankCursorRules`, true);

  const syncCursorRulesMode = pickEnum<OneClickRulesMode>(
    ws.get<string>(`${CFG}.oneClickSetup.syncCursorRulesMode`, "apply"),
    ["apply", "dryRun", "off"],
    "apply",
    notes,
    "syncCursorRulesMode"
  );
  const syncRules = migrateFromCursor && syncCursorRulesMode !== "off";
  const syncRulesDry = syncCursorRulesMode === "dryRun";

  const appendCr = migrateFromCursor && ws.get<boolean>(`${CFG}.oneClickSetup.appendCursorrules`, true);

  const portMode = migrateFromCursor ? getPortMode(notes) : "skip";

  const mergeCopilotMd =
    migrateFromGitHubCopilot &&
    ws.get<boolean>(`${CFG}.oneClickSetup.mergeCopilotInstructionsIntoClaudeMd`, true);

  const copilotSkillsTarget = pickEnum<OneClickSkillsTarget>(
    ws.get<string>(`${CFG}.oneClickSetup.migrateCopilotSkillsTarget`, "workspace"),
    ["off", "workspace", "user", "both"],
    "workspace",
    notes,
    "migrateCopilotSkillsTarget"
  );
  const migrateCopilotSkills = migrateFromGitHubCopilot && copilotSkillsTarget !== "off";
  const copilotSkillsScope = (migrateCopilotSkills ? copilotSkillsTarget : "workspace") as
    | "workspace"
    | "user"
    | "both";
  const copilotSkillsMode = pickEnum<OneClickSkillsMode>(
    ws.get<string>(`${CFG}.oneClickSetup.migrateCopilotSkillsMode`, "copy"),
    ["copy", "move"],
    "copy",
    notes,
    "migrateCopilotSkillsMode"
  ) as MigrateSkillMode;

  const copilotMcpReminder =
    migrateFromGitHubCopilot &&
    ws.get<boolean>(`${CFG}.oneClickSetup.copilotMcpReminderAfterOneClick`, true);

  const mergePolicy = pickEnum<OneClickInstructionMergePolicy>(
    ws.get<string>(`${CFG}.oneClickSetup.instructionMergeAfterOneClick`, "enableAutoScan"),
    ["enableAutoScan", "mergeClaudeMdOnce", "leaveUnchanged"],
    "enableAutoScan",
    notes,
    "instructionMergeAfterOneClick"
  );
  const turnOnAutoScan = mergePolicy === "enableAutoScan";
  const forceInstructionMergeOnce = mergePolicy === "mergeClaudeMdOnce";

  const runAwareness = ws.get<boolean>(`${CFG}.oneClickSetup.runAwarenessScan`, true);
  const runReadiness = ws.get<boolean>(`${CFG}.oneClickSetup.runReadiness`, true);
  const runScan = ws.get<boolean>(`${CFG}.oneClickSetup.runConfigScan`, true);
  const runTest = ws.get<boolean>(`${CFG}.oneClickSetup.runFirstTestTask`, false);

  try {
    // --- Cursor → Claude Code ---
    if (migrateCursorSkills) {
      const bases: string[] = [];
      if (migrateCursorScope === "workspace" || migrateCursorScope === "both") {
        bases.push(folder.uri.fsPath);
      }
      if (migrateCursorScope === "user" || migrateCursorScope === "both") {
        bases.push(os.homedir());
      }
      for (const base of bases) {
        const run = await runMigrationForRoot(base, migrateMode);
        if (run.errors > 0) {
          notes.push(`[Cursor] skills: ${run.errors} error(s) under ${run.skillsSourcePath}`);
        }
      }
      refreshHub();
    }

    if (syncRules) {
      const okRules = runSyncCursorRulesBundledWithOptions(folder, syncRulesDry, qm);
      if (!okRules) {
        notes.push("[Cursor] rules → CLAUDE.md: bundled CLI not found under extension");
      }
    }

    if (appendCr) {
      try {
        const rulesUri = vscode.Uri.joinPath(folder.uri, ".cursorrules");
        await vscode.workspace.fs.stat(rulesUri);
        await appendCursorrules();
      } catch {
        /* no .cursorrules — skip quietly */
      }
    }

    if (portMode !== "skip") {
      const okPort = await runPortCursorMcpBundledWithMode(folder, portMode, qm);
      if (!okPort) {
        notes.push("[Cursor] MCP port: bundled CLI not found under extension");
      }
    }

    // --- VS Code / Copilot MCP → Claude Code (merge) ---
    if (portMode === "claude" || portMode === "claudeProject") {
      try {
        const vsResult = await portVsCodeMcpToClaudeCode({
          scope: portMode === "claude" ? "user" : "project",
          workspacePath: folder.uri.fsPath,
        });
        if (vsResult.merged.length > 0) {
          notes.push(`[VS Code/Copilot] MCP: merged ${vsResult.merged.length} server(s) into Claude Code config`);
        }
      } catch {
        // VS Code mcp.json may not exist — that's fine
      }
    }

    // --- GitHub Copilot → Claude Code ---
    if (mergeCopilotMd) {
      try {
        const merged = await mergeCopilotInstructionsIntoClaudeMdSilent(folder);
        if (!merged) {
          notes.push("[Copilot] skip: .github/copilot-instructions.md missing or empty");
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        notes.push(`[Copilot] merge copilot-instructions failed: ${m}`);
      }
    }

    if (migrateCopilotSkills) {
      if (copilotSkillsScope === "workspace" || copilotSkillsScope === "both") {
        const run = await runCopilotGithubSkillsMigrationForRoot(folder.uri.fsPath, copilotSkillsMode);
        if (run.errors > 0) {
          notes.push(`[Copilot] skills: ${run.errors} error(s) under ${run.skillsSourcePath}`);
        }
      }
      if (copilotSkillsScope === "user" || copilotSkillsScope === "both") {
        const run = await runCopilotUserSkillsMigrationForRoot(os.homedir(), copilotSkillsMode);
        if (run.errors > 0) {
          notes.push(`[Copilot] skills: ${run.errors} error(s) under ${run.skillsSourcePath}`);
        }
      }
      refreshHub();
    }

    // --- Shared: memory bank (after CLAUDE.md merges from Cursor + Copilot paths) ---
    if (initMb) {
      const okMb = await runInitMemoryBankBundledWithOptions(
        folder,
        {
          dryRun: initMbDry,
          cursorRules: initMbCursor,
        },
        qm
      );
      if (!okMb) {
        notes.push("Memory bank: init failed");
      }
    }

    if (turnOnAutoScan) {
      await ws.update(`${CFG}.intelligence.autoScanMcpSkillsOnWorkspaceOpen`, true, scope);
    }

    if (runAwareness) {
      await showMcpSkillsAwareness(context, {
        silentNotification: true,
        forceMergeIntoInstructions: forceInstructionMergeOnce,
      });
    }

    // --- Token Optimization: enable by default during One Click Setup ---
    {
      const toEnabled = ws.get<boolean>(`${CFG}.tokenOptimization.enabled`, false);
      if (!toEnabled) {
        await ws.update(`${CFG}.tokenOptimization.enabled`, true, scope);
        await context.globalState.update("tokenOptimizationActivationAcknowledged", true);
        const { runTokenOptimizationEnable } = await import("../intelligence/tokenOptimization/tokenOptimizationCommand");
        await runTokenOptimizationEnable();
      }
    }

    if (runReadiness) {
      await showIntelligenceReadiness();
    }

    if (runScan) {
      await runClaudeToolboxConfigScan();
    }

    if (runTest) {
      await runFirstWorkspaceTestTask();
    }

    refreshHub();

    if (copilotMcpReminder) {
      void vscode.window.showInformationMessage(
        "Cloude Code ToolBox: VS Code `mcp.json` is for the editor; Claude Code uses `/mcp` in the Claude panel. Align servers in both places if needed.",
        "Open user mcp.json"
      ).then((choice) => {
        if (choice === "Open user mcp.json") {
          void vscode.commands.executeCommand("CloudeCodeToolBox.openUserMcp");
        }
      });
    }

    const msg =
      notes.length > 0
        ? `One Click Setup finished (see terminal(s) for bundled CLIs). Notes: ${notes.join(" · ")}`
        : "One Click Setup finished. Review terminals, Output (config scan), and any opened docs.";
    await vscode.window.showInformationMessage(msg);

    await vscode.window.showWarningMessage(
      "Claude Code ToolBox: Please close and reopen VS Code for all changes to take effect. Hooks and configuration updates require a fresh VS Code window.",
      { modal: true },
      "OK"
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`One Click Setup failed: ${m}`);
  }
}
