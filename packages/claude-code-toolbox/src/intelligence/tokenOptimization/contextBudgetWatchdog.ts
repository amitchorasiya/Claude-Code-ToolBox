/**
 * Context budget watchdog: tiered alerts when context fill exceeds thresholds.
 * Integrates with the existing Agent Dashboard sessionStore.
 *
 * This file has a vscode import (it subscribes to the dashboard event system
 * and shows toasts), so it is NOT pure-logic — it's an integration module.
 */
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../../toolboxSettings";

export type BudgetThreshold = {
  percent: number;
  severity: "info" | "warning" | "critical";
  message: string;
};

export const DEFAULT_THRESHOLDS: BudgetThreshold[] = [
  { percent: 70, severity: "info", message: "Context window 70% full — consider scoping your next request." },
  { percent: 85, severity: "warning", message: "Context window 85% full — run /compact to free space." },
  { percent: 95, severity: "critical", message: "Context window 95% full — compaction urgently needed or start a new session." },
];

export function getConfiguredThresholds(): BudgetThreshold[] {
  const cfg = vscode.workspace.getConfiguration();
  const percents = cfg.get<number[]>(
    `${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.contextBudget.thresholds`,
    [70, 85, 95]
  );
  return percents.map((p, i) => {
    const severity: BudgetThreshold["severity"] =
      i === 0 ? "info" : i === 1 ? "warning" : "critical";
    const message =
      p >= 95
        ? `Context window ${p}% full — compaction urgently needed or start a new session.`
        : p >= 85
          ? `Context window ${p}% full — run /compact to free space.`
          : `Context window ${p}% full — consider scoping your next request.`;
    return { percent: p, severity, message };
  });
}

const alertedThresholds = new Set<string>();

export function checkContextBudget(
  sessionId: string,
  contextUsed: number,
  contextMax: number
): void {
  if (contextMax <= 0) return;

  const cfg = vscode.workspace.getConfiguration();
  const enabled = cfg.get<boolean>(
    `${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.contextBudget.enabled`,
    true
  );
  if (!enabled) return;

  const fillPercent = Math.round((contextUsed / contextMax) * 100);
  const thresholds = getConfiguredThresholds();

  for (const threshold of thresholds) {
    const key = `${sessionId}:${threshold.percent}`;
    if (fillPercent >= threshold.percent && !alertedThresholds.has(key)) {
      alertedThresholds.add(key);
      showBudgetAlert(threshold, fillPercent);
    }
  }
}

function showBudgetAlert(threshold: BudgetThreshold, actual: number): void {
  const msg = `Token Optimization: ${threshold.message}`;
  switch (threshold.severity) {
    case "info":
      void vscode.window.showInformationMessage(msg);
      break;
    case "warning":
      void vscode.window.showWarningMessage(msg, "Run /compact").then((choice) => {
        if (choice === "Run /compact") {
          void vscode.commands.executeCommand("CloudeCodeToolBox.openClaudeCode");
        }
      });
      break;
    case "critical":
      void vscode.window.showErrorMessage(msg, "Open Claude Code").then((choice) => {
        if (choice === "Open Claude Code") {
          void vscode.commands.executeCommand("CloudeCodeToolBox.openClaudeCode");
        }
      });
      break;
  }
}

export function resetAlertsForSession(sessionId: string): void {
  for (const key of alertedThresholds) {
    if (key.startsWith(`${sessionId}:`)) {
      alertedThresholds.delete(key);
    }
  }
}
