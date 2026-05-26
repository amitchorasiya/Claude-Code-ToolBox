/**
 * HybridSpawner — a SpawnAgentTurnFn implementation that reuses persistent
 * native Agent Teams sessions per agent instead of spawning fresh subprocesses.
 *
 * When the team runtime is "agent-teams", the orchestrator passes this spawner
 * to protocol state machines (debate, plan-then-code, converge, orchestrator).
 * Each agent gets a persistent `claude` session that is resumed across turns
 * via `--resume <sessionId>`. This maps to native Agent Teams' persistent
 * teammate model while preserving ToolBox's protocol control (round structure,
 * approval gates, transcript management).
 *
 * Fallback: if native teams is unavailable or the session fails to resume,
 * falls back to the standard single-turn spawn (same as custom runtime).
 */
import type { AgentEntry } from "../localAgents";
import type { AgentRunEvent, RunPhase } from "./eventTypes";
import { nowIso } from "./eventTypes";
import { spawnAgentTurn as standardSpawn } from "./claudeSpawn";
import type { SpawnAgentTurnFn } from "./runtimeTypes";

export type HybridSpawnerOptions = {
  claudeBin?: string;
  enableNativeTeams: boolean;
};

type SessionEntry = {
  agentName: string;
  sessionId: string | undefined;
  turnCount: number;
};

/**
 * Creates a SpawnAgentTurnFn that maintains session continuity per agent.
 * On the first call for an agent, spawns normally and captures the session ID
 * from the result event. On subsequent calls, resumes the same session so the
 * agent retains full context from prior turns.
 */
export function createHybridSpawner(opts: HybridSpawnerOptions): SpawnAgentTurnFn {
  const sessions = new Map<string, SessionEntry>();

  return async function* (args: {
    agent: AgentEntry;
    prompt: string;
    runId: string;
    turn: number;
    phase: RunPhase;
    cwd?: string;
    signal?: AbortSignal;
    claudeBin?: string;
  }): AsyncIterable<AgentRunEvent> {
    const entry = sessions.get(args.agent.name) ?? {
      agentName: args.agent.name,
      sessionId: undefined,
      turnCount: 0,
    };

    const env: NodeJS.ProcessEnv = opts.enableNativeTeams
      ? { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" }
      : {};

    entry.turnCount += 1;
    sessions.set(args.agent.name, entry);

    let capturedSessionId: string | undefined;

    for await (const ev of standardSpawn({
      agent: args.agent,
      prompt: args.prompt,
      runId: args.runId,
      turn: args.turn,
      phase: args.phase,
      cwd: args.cwd,
      signal: args.signal,
      claudeBin: args.claudeBin ?? opts.claudeBin,
      sessionId: entry.sessionId,
      env,
    })) {
      if (ev.kind === "log" && ev.message.includes("session_id:")) {
        const m = ev.message.match(/session_id:\s*(\S+)/);
        if (m) {
          capturedSessionId = m[1];
        }
      }
      yield ev;
    }

    if (capturedSessionId) {
      entry.sessionId = capturedSessionId;
      sessions.set(args.agent.name, entry);
    }
  };
}

/**
 * Creates a SpawnAgentTurnFn that emits teammate visibility events around each
 * turn. Wraps any inner spawner with teammate_spawned / teammate_idle events
 * so the dashboard shows per-agent lifecycle even when using the standard
 * subprocess-per-turn approach.
 */
export function withTeammateVisibility(inner: SpawnAgentTurnFn): SpawnAgentTurnFn {
  const spawned = new Set<string>();

  return async function* (args): AsyncIterable<AgentRunEvent> {
    const isNew = !spawned.has(args.agent.name);
    if (isNew) {
      spawned.add(args.agent.name);
      yield {
        kind: "teammate_spawned",
        t: nowIso(),
        runId: args.runId,
        teammate: args.agent.name,
        agentType: args.agent.role,
        status: "running",
      } as AgentRunEvent;
    }

    yield* inner(args);

    yield {
      kind: "teammate_idle",
      t: nowIso(),
      runId: args.runId,
      teammate: args.agent.name,
    } as AgentRunEvent;
  };
}
