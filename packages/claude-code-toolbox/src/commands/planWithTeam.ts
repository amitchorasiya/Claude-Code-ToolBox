/**
 * Phase 1.5 command: "Plan with Agent Team…" — a parallel entry point to
 * Claude Code's built-in /plan, routing the user's task through our
 * plan-then-code orchestrator. Not a replacement: both paths remain available.
 */
import * as os from "node:os";
import * as vscode from "vscode";
import { collectLocalAgents } from "../agents/localAgents";
import { collectLocalTeams } from "../agents/teamsStore";
import { startTeamRun } from "../agents/runtime/runOrchestrator";
import { attachRunBusToStore } from "../agents/dashboard/sessionBridge";
import type { DashboardController } from "../agents/dashboard/dashboardController";
import { TOOLBOX_SETTINGS_PREFIX } from "../toolboxSettings";

export async function planWithTeamCommand(
  dashboard?: DashboardController
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const homeDir = os.homedir();
  const cfg = vscode.workspace.getConfiguration();
  const defaultTeamName = cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.defaultPairTeamName`,
    "sdlc-debate"
  );
  const teams = await collectLocalTeams(homeDir, folder?.uri.fsPath);
  if (!teams.length) {
    vscode.window.showWarningMessage(
      "No teams defined yet. Open the Teams tab and create one (or install the SDLC starter pack)."
    );
    return;
  }
  let team = teams.find((t) => t.name === defaultTeamName);
  if (!team) {
    const picked = await vscode.window.showQuickPick(
      teams.map((t) => ({
        label: t.name,
        description: `${t.protocol} · ${t.runtime}`,
        detail: t.description || `${t.agents.length} agent(s)`,
        team: t,
      })),
      { placeHolder: "Pick a team for planning" }
    );
    if (!picked) return;
    team = picked.team;
  }
  const editor = vscode.window.activeTextEditor;
  let selectionHint = "";
  if (editor && !editor.selection.isEmpty) {
    selectionHint = `\n\nRelevant code (from ${editor.document.fileName}):\n\n` + editor.document.getText(editor.selection);
  }
  const prompt = await vscode.window.showInputBox({
    prompt: `Plan with team "${team.name}" — describe the task`,
    placeHolder: "Design an import pipeline with retries and dead-letter queue",
    ignoreFocusOut: true,
  });
  if (!prompt) return;
  const fullPrompt = prompt.trim() + selectionHint;
  const agents = await collectLocalAgents(homeDir, folder?.uri.fsPath);
  const claudeBin = cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.claudeBinOverride`,
    ""
  );
  const maxConcurrent = cfg.get<number>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.maxConcurrentAgents`,
    3
  );
  const budgetUsd = cfg.get<number>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.costCapUsd`,
    0
  );
  const { run } = startTeamRun({
    team,
    agents,
    userPrompt: fullPrompt,
    workspaceRoot: folder?.uri.fsPath,
    claudeBin: claudeBin || undefined,
    maxConcurrentAgents: maxConcurrent,
    budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
    onStarted: (r) => {
      if (!dashboard) return;
      try {
        attachRunBusToStore(r.bus, dashboard.store, {
          team: team!,
          cwd: folder?.uri.fsPath,
          budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
        });
      } catch {
        /* ignore */
      }
    },
  });
  vscode.window.showInformationMessage(
    `Team "${team.name}" started (run ${run.runId}). Watch progress in the Teams tab.`
  );
  void vscode.commands.executeCommand("workbench.view.extension.CloudeCodeToolBox");
}
