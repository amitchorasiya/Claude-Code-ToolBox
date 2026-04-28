/**
 * Phase 1.5 command: "Smart router" — a quick-pick that reads the user's
 * intent and offers one of three workflows (plan-then-code, debate, or a
 * single round-robin session). Inspired by claude-octopus `/octo:auto`.
 */
import * as vscode from "vscode";
import type { DashboardController } from "../agents/dashboard/dashboardController";
import { planWithTeamCommand } from "./planWithTeam";

export type RouterIntent = "plan" | "debate" | "single";

export function classifyPromptIntent(prompt: string): RouterIntent {
  const p = prompt.toLowerCase();
  if (/\b(plan|design|architect|sdlc|rfc|spec|roadmap|decompose)\b/.test(p)) return "plan";
  if (/\b(compare|trade.?off|debate|which (option|approach)|pros? and cons?|should we|verdict)\b/.test(p))
    return "debate";
  return "single";
}

export async function smartRouterCommand(dashboard?: DashboardController): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    prompt: "Smart router — describe the task",
    placeHolder: "Design an import pipeline that handles retries and dead-letter queue",
    ignoreFocusOut: true,
  });
  if (!prompt) return;
  const intent = classifyPromptIntent(prompt);
  const items = [
    {
      label: "$(lightbulb) Plan with team",
      description: "plan-then-code · approval gate",
      detail: "Runs the full plan-then-code protocol: plan agents debate → you approve → code agents execute.",
      id: "plan" as RouterIntent,
    },
    {
      label: "$(comment-discussion) Debate",
      description: "debate · judge verdict",
      detail: "N rounds of disagreement between plan agents; judge writes decision.md.",
      id: "debate" as RouterIntent,
    },
    {
      label: "$(zap) Single round-robin",
      description: "round-robin · quick",
      detail: "One pass of round-robin through a single team. Fastest option.",
      id: "single" as RouterIntent,
    },
  ];
  /* Reorder so the inferred intent is first. */
  items.sort((a, b) => (a.id === intent ? -1 : b.id === intent ? 1 : 0));
  items[0].label += "  (suggested)";
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Inferred: ${intent}. Pick a workflow to dispatch.`,
  });
  if (!picked) return;
  if (picked.id === "plan" || picked.id === "debate") {
    /* Delegate to planWithTeamCommand with the prompt pre-captured. */
    await vscode.env.clipboard.writeText(prompt);
    void planWithTeamCommand(dashboard);
    return;
  }
  /* "single" → we just delegate to planWithTeamCommand and trust the user's team choice. */
  void planWithTeamCommand(dashboard);
}
