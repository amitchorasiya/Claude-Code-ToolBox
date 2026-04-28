/**
 * Shared runtime interfaces used by protocol state machines. Protocols depend
 * on these abstractions rather than `claudeSpawn` directly so tests can supply
 * a scripted spawner.
 */
import type { AgentEntry } from "../localAgents";
import type { TeamEntry } from "../teamsStore";
import type { AgentRunEvent, RunPhase } from "./eventTypes";
import type { RunBus } from "./runBus";

export type SpawnAgentTurnFn = (args: {
  agent: AgentEntry;
  prompt: string;
  runId: string;
  turn: number;
  phase: RunPhase;
  cwd?: string;
  signal?: AbortSignal;
  claudeBin?: string;
}) => AsyncIterable<AgentRunEvent>;

export type SpawnSessionFn = (args: {
  prompt: string;
  runId: string;
  phase: RunPhase;
  cwd?: string;
  signal?: AbortSignal;
  claudeBin?: string;
  allowedAgents?: string[];
  appendSystemPrompt?: string;
}) => AsyncIterable<AgentRunEvent>;

export type ProtocolContext = {
  team: TeamEntry;
  agents: AgentEntry[];
  userPrompt: string;
  bus: RunBus;
  runId: string;
  cwd?: string;
  signal: AbortSignal;
  claudeBin?: string;
  runDir: string;
  spawnAgentTurn: SpawnAgentTurnFn;
  spawnSession: SpawnSessionFn;
  /** Called when the protocol reaches a phase_boundary that needs approval.
   *  Resolves with the user's decision + optional edited plan text. */
  awaitApproval?: (planPath: string) => Promise<{
    decision: "approve" | "reject";
    reason?: string;
    editedPlan?: string;
  }>;
};

export type ProtocolResult = {
  status: "completed" | "aborted" | "error";
  totals: { inputTokens: number; outputTokens: number; costUsd: number };
  planArtifactPath?: string;
};

export type Protocol = (ctx: ProtocolContext) => Promise<ProtocolResult>;
