/**
 * Adapter: subscribe an internal RunBus to the dashboard SessionStore so
 * orchestrator runs appear alongside external Claude sessions in one UI.
 */
import type { RunBus } from "../runtime/runBus";
import type { SessionStore } from "./sessionStore";
import type { TeamEntry } from "../teamsStore";

export type BridgeContext = {
  team: TeamEntry;
  cwd?: string;
  budgetUsd?: number;
};

export function attachRunBusToStore(
  bus: RunBus,
  store: SessionStore,
  ctx: BridgeContext
): () => void {
  const runContext = {
    teamId: ctx.team.id,
    teamName: ctx.team.name,
    protocol: ctx.team.protocol,
    runtime: ctx.team.runtime,
    cwd: ctx.cwd,
    budgetUsd: ctx.budgetUsd,
  };
  return bus.on((event) => {
    try {
      store.applyRunBusPatch(event, runContext);
    } catch {
      /* swallow — bridge must never block the bus */
    }
  });
}
