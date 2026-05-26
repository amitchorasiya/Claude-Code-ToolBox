/**
 * Entry-point for launching an agent-team run. Given a team definition and a
 * user prompt, picks the right protocol, creates a bus + abort-controller,
 * registers the run, and kicks off the async pipeline.
 *
 * The caller (usually the hub view) subscribes to `bus.on(...)` to receive
 * live events for the webview transcript.
 */
import * as os from "node:os";
import * as path from "node:path";
import { spawnAgentTurn, spawnClaudeSession } from "./claudeSpawn";
import type { AgentEntry } from "../localAgents";
import type { TeamEntry } from "../teamsStore";
import { nowIso } from "./eventTypes";
import type { AgentRunEvent, RunStatus } from "./eventTypes";
import { RunBus } from "./runBus";
import { registerRun, updateRun, type ActiveRun } from "./runRegistry";
import type { Protocol, SpawnAgentTurnFn, SpawnSessionFn } from "./runtimeTypes";
import { nativeTask } from "./protocols/nativeTask";
import { roundRobin } from "./protocols/roundRobin";
import { handoff } from "./protocols/handoff";
import { orchestrator } from "./protocols/orchestrator";
import { makeParallelFanout } from "./protocols/parallelFanout";
import { debate } from "./protocols/debate";
import { planThenCode } from "./protocols/planThenCode";
import { makeConverge } from "./protocols/converge";
import { makeNativeTeamBridge } from "./nativeTeamBridge";
import { createHybridSpawner, withTeammateVisibility } from "./hybridSpawner";
import { attachMarkdownTranscript } from "./transcriptMarkdown";

export type StartRunOptions = {
  team: TeamEntry;
  agents: AgentEntry[];
  userPrompt: string;
  workspaceRoot?: string;
  claudeBin?: string;
  maxConcurrentAgents?: number;
  /** Override for tests — scripted spawner instead of real CLI. */
  spawnAgentTurnOverride?: SpawnAgentTurnFn;
  spawnSessionOverride?: SpawnSessionFn;
  /** Optional observer called with the started run; used to attach the dashboard bridge. */
  onStarted?: (run: ActiveRun) => void;
  /** Soft cost budget for this run (mirrored into dashboard cards). */
  budgetUsd?: number;
  /** Custom directory for run artifacts. Supports ${workspaceFolder} variable. */
  runArtifactsDir?: string;
};

export type StartRunResult = {
  run: ActiveRun;
  finished: Promise<{ status: RunStatus; planArtifactPath?: string }>;
};

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "-");
}

const NATIVE_BRIDGE_PROTOCOLS = new Set(["native-task", "round-robin", "handoff", "parallel-fan-out"]);

function pickProtocol(team: TeamEntry, opts: { maxConcurrent: number }): Protocol {
  if (team.runtime === "agent-teams" && NATIVE_BRIDGE_PROTOCOLS.has(team.protocol)) {
    return makeNativeTeamBridge({ maxConcurrent: opts.maxConcurrent });
  }
  switch (team.protocol) {
    case "native-task":
      return nativeTask;
    case "round-robin":
      return roundRobin;
    case "handoff":
      return handoff;
    case "orchestrator":
      return orchestrator;
    case "parallel-fan-out":
      return makeParallelFanout({ maxConcurrent: opts.maxConcurrent });
    case "debate":
      return debate;
    case "plan-then-code":
      return planThenCode;
    case "converge":
      return makeConverge({ maxConcurrent: opts.maxConcurrent });
    default:
      return nativeTask;
  }
}

function makeRunId(team: TeamEntry): string {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `${iso}-${sanitize(team.name)}`;
}

function resolveRunDir(team: TeamEntry, workspaceRoot: string | undefined, runId: string, customDir?: string): string {
  if (customDir?.trim()) {
    const resolved = customDir.replace(/\$\{workspaceFolder\}/g, workspaceRoot ?? os.homedir());
    return path.join(resolved, runId);
  }
  const base = workspaceRoot ?? os.homedir();
  return path.join(base, ".claude", "runs", runId);
}

export function startTeamRun(opts: StartRunOptions): StartRunResult {
  const runId = makeRunId(opts.team);
  const runDir = resolveRunDir(opts.team, opts.workspaceRoot, runId, opts.runArtifactsDir);
  const jsonlPath = path.join(runDir, "transcript.jsonl");
  const bus = new RunBus(runId, jsonlPath);
  const abort = new AbortController();
  const active: ActiveRun = {
    runId,
    teamId: opts.team.id,
    teamName: opts.team.name,
    protocol: opts.team.protocol,
    runtime: opts.team.runtime,
    phase: "none",
    status: "running",
    startedAt: nowIso(),
    jsonlPath,
    bus,
    abort,
  };
  registerRun(active);
  try {
    opts.onStarted?.(active);
  } catch {
    /* observer errors must never block the run */
  }

  bus.emit({
    kind: "run_start",
    t: nowIso(),
    runId,
    teamId: opts.team.id,
    teamName: opts.team.name,
    protocol: opts.team.protocol,
    runtime: opts.team.runtime,
    phase: "none",
  });
  bus.on((ev: AgentRunEvent) => {
    if (ev.kind === "phase_boundary") {
      updateRun(runId, { phase: ev.to, status: ev.needsApproval ? "awaiting_approval" : "running" });
    }
  });
  attachMarkdownTranscript(bus, runDir);

  const protocol = pickProtocol(opts.team, {
    maxConcurrent: opts.maxConcurrentAgents ?? 3,
  });
  const isHybridNative = opts.team.runtime === "agent-teams" && !NATIVE_BRIDGE_PROTOCOLS.has(opts.team.protocol);
  const baseSpawnFn: SpawnAgentTurnFn = opts.spawnAgentTurnOverride
    ?? (isHybridNative
      ? createHybridSpawner({ claudeBin: opts.claudeBin, enableNativeTeams: true })
      : async function* (args) {
        yield* spawnAgentTurn({
          agent: args.agent,
          prompt: args.prompt,
          runId: args.runId,
          turn: args.turn,
          phase: args.phase,
          cwd: args.cwd,
          signal: args.signal,
          claudeBin: args.claudeBin,
        });
      });
  const spawnAgentTurnFn: SpawnAgentTurnFn = isHybridNative
    ? withTeammateVisibility(baseSpawnFn)
    : baseSpawnFn;
  const spawnSessionFn: SpawnSessionFn = opts.spawnSessionOverride
    ?? (async function* (args) {
      yield* spawnClaudeSession({
        prompt: args.prompt,
        runId: args.runId,
        phase: args.phase,
        cwd: args.cwd,
        signal: args.signal,
        claudeBin: args.claudeBin,
        allowedAgents: args.allowedAgents,
        appendSystemPrompt: args.appendSystemPrompt,
      });
    });

  const awaitApproval = async (planPath: string): Promise<{ decision: "approve" | "reject"; reason?: string; editedPlan?: string }> =>
    new Promise((resolve) => {
      const run = active;
      run.pendingApproval = {
        planPath,
        resolve: (decision, reason) => {
          run.pendingApproval = undefined;
          resolve({ decision, reason });
        },
      };
      const onAbort = () => {
        if (run.pendingApproval) {
          run.pendingApproval = undefined;
          resolve({ decision: "reject", reason: "run aborted" });
        }
      };
      abort.signal.addEventListener("abort", onAbort, { once: true });
    });

  const finished = (async (): Promise<{ status: RunStatus; planArtifactPath?: string }> => {
    let status: RunStatus = "running";
    let planArtifactPath: string | undefined;
    let runTotals = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    try {
      const result = await protocol({
        team: opts.team,
        agents: opts.agents,
        userPrompt: opts.userPrompt,
        bus,
        runId,
        cwd: opts.workspaceRoot,
        signal: abort.signal,
        claudeBin: opts.claudeBin,
        runDir,
        spawnAgentTurn: spawnAgentTurnFn,
        spawnSession: spawnSessionFn,
        awaitApproval,
      });
      status = result.status;
      planArtifactPath = result.planArtifactPath;
      if (result.totals) {
        runTotals = result.totals;
      }
    } catch (e) {
      status = "error";
      bus.emit({
        kind: "error",
        t: nowIso(),
        runId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    bus.emit({
      kind: "run_end",
      t: nowIso(),
      runId,
      status,
      totals: runTotals,
    });
    updateRun(runId, { status });
    await bus.flush();
    return { status, planArtifactPath };
  })();

  return { run: active, finished };
}

/** Called by the webview when the user clicks Approve or Reject. */
export function resolvePendingApproval(
  run: ActiveRun,
  decision: "approve" | "reject",
  reason?: string
): boolean {
  const pending = run.pendingApproval;
  if (!pending) {
    return false;
  }
  pending.resolve(decision, reason);
  return true;
}

/** Called by the webview when the user clicks Stop. */
export function abortRun(run: ActiveRun): void {
  try {
    run.abort.abort();
  } catch {
    /* already aborted */
  }
}
