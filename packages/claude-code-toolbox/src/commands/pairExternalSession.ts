/**
 * Phase 1.5 heuristic: when an external Claude session's first human turn
 * looks like a planning task, offer a toast to pair it with our SDLC Debate
 * team.
 *
 * Wired from the dashboard controller's store subscription.
 */
import * as os from "node:os";
import * as vscode from "vscode";
import type { DashboardController } from "../agents/dashboard/dashboardController";
import type { SessionCard } from "../agents/dashboard/sessionStore";
import { collectLocalAgents } from "../agents/localAgents";
import { collectLocalTeams } from "../agents/teamsStore";
import { startTeamRun } from "../agents/runtime/runOrchestrator";
import { attachRunBusToStore } from "../agents/dashboard/sessionBridge";
import { TOOLBOX_SETTINGS_PREFIX, safeUpdateToolboxSetting } from "../toolboxSettings";

const PLAN_RE = /\b(plan|design|architect|sdlc|spec|rfc|roadmap|decompose|break.?down)\b/i;
const offered = new Set<string>();

export function shouldOfferPairing(card: SessionCard): boolean {
  if (card.source !== "external") return false;
  if (!card.title) return false;
  if (offered.has(card.sessionId)) return false;
  return PLAN_RE.test(card.title);
}

export async function maybeOfferPlanPairing(
  card: SessionCard,
  dashboard?: DashboardController
): Promise<void> {
  if (!shouldOfferPairing(card)) return;
  const cfg = vscode.workspace.getConfiguration();
  const enabled =
    cfg.get<boolean>(
      `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.autoPairPlanningPrompts`,
      false
    ) === true;
  if (!enabled) return;
  offered.add(card.sessionId);
  const pick = await vscode.window.showInformationMessage(
    `Detected a planning prompt in a Claude session. Pair it with your "${
      cfg.get<string>(
        `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.defaultPairTeamName`,
        "sdlc-debate"
      )
    }" team?`,
    "Pair now",
    "Not now",
    "Don't ask again"
  );
  if (pick === "Don't ask again") {
    await safeUpdateToolboxSetting("agentDashboard.autoPairPlanningPrompts", false);
    return;
  }
  if (pick !== "Pair now") return;
  const folder = vscode.workspace.workspaceFolders?.[0];
  const homeDir = os.homedir();
  const defaultName = cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.defaultPairTeamName`,
    "sdlc-debate"
  );
  const teams = await collectLocalTeams(homeDir, folder?.uri.fsPath);
  const team = teams.find((t) => t.name === defaultName) ?? teams[0];
  if (!team) {
    vscode.window.showWarningMessage("No teams defined — open the Teams tab to create one.");
    return;
  }
  const agents = await collectLocalAgents(homeDir, folder?.uri.fsPath);
  const budgetUsd = cfg.get<number>(`${TOOLBOX_SETTINGS_PREFIX}.agentTeams.costCapUsd`, 0);
  startTeamRun({
    team,
    agents,
    userPrompt: card.title,
    workspaceRoot: folder?.uri.fsPath,
    claudeBin:
      cfg.get<string>(`${TOOLBOX_SETTINGS_PREFIX}.agentTeams.claudeBinOverride`, "") || undefined,
    maxConcurrentAgents: cfg.get<number>(
      `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.maxConcurrentAgents`,
      3
    ),
    budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
    onStarted: (r) => {
      if (!dashboard) return;
      try {
        attachRunBusToStore(r.bus, dashboard.store, {
          team,
          cwd: folder?.uri.fsPath,
          budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
        });
      } catch {
        /* ignore */
      }
    },
  });
  vscode.window.showInformationMessage(`Started "${team.name}" paired with the Claude session.`);
}
