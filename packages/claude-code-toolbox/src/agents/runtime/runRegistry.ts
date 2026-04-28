/**
 * In-process registry of active team runs so the webview and commands can find
 * the bus / abort-controller for a given runId. Shared across the extension
 * host lifetime; cleared on deactivation.
 */
import type { RunBus } from "./runBus";
import type { RunPhase, RunStatus } from "./eventTypes";

export type ActiveRun = {
  runId: string;
  teamId: string;
  teamName: string;
  protocol: string;
  runtime: "native" | "custom";
  phase: RunPhase;
  status: RunStatus;
  startedAt: string;
  jsonlPath: string;
  bus: RunBus;
  abort: AbortController;
  /** Resolvers for approval gates; set when the orchestrator awaits user action. */
  pendingApproval?: {
    planPath: string;
    resolve: (decision: "approve" | "reject", reason?: string) => void;
  };
};

const runs = new Map<string, ActiveRun>();

export function registerRun(run: ActiveRun): void {
  runs.set(run.runId, run);
}

export function getRun(runId: string): ActiveRun | undefined {
  return runs.get(runId);
}

export function listActiveRuns(): ActiveRun[] {
  return Array.from(runs.values()).filter((r) => r.status === "running" || r.status === "awaiting_approval");
}

export function listAllRuns(): ActiveRun[] {
  return Array.from(runs.values());
}

export function updateRun(runId: string, patch: Partial<ActiveRun>): void {
  const r = runs.get(runId);
  if (!r) {
    return;
  }
  Object.assign(r, patch);
}

export function clearRun(runId: string): void {
  runs.delete(runId);
}

/** Clear runs whose status is terminal — called periodically and on restart. */
export function pruneTerminalRuns(): void {
  for (const [id, r] of runs) {
    if (r.status === "completed" || r.status === "aborted" || r.status === "error") {
      runs.delete(id);
    }
  }
}
