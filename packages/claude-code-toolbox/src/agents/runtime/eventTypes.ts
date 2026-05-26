/**
 * Event types for an agent-team run.
 *
 * Both the native-task runtime and the custom orchestrator protocols emit the
 * same shape onto the per-run `EventEmitter`; the webview reads these as a
 * single stream regardless of which protocol produced them.
 *
 * Each event is also appended as a JSON line to `.claude/runs/<id>.jsonl`.
 */

export type AgentRunKind =
  | "run_start"
  | "phase_boundary"
  | "agent_start"
  | "agent_end"
  | "assistant_delta"
  | "assistant_message"
  | "tool_use"
  | "tool_result"
  | "usage"
  | "message"
  | "plan_artifact"
  | "teammate_spawned"
  | "teammate_idle"
  | "task_created"
  | "task_completed"
  | "error"
  | "log"
  | "run_end";

export type RunPhase = "none" | "plan" | "code";

export type RunStatus = "running" | "awaiting_approval" | "completed" | "aborted" | "error";

export type RunUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

export type AgentRunEvent =
  | { kind: "run_start"; t: string; runId: string; teamId: string; teamName: string; protocol: string; runtime: "native" | "custom" | "agent-teams"; phase: RunPhase }
  | { kind: "phase_boundary"; t: string; runId: string; from: RunPhase; to: RunPhase; needsApproval: boolean; planPath?: string }
  | { kind: "agent_start"; t: string; runId: string; agent: string; color?: string; turn: number; phase: RunPhase }
  | { kind: "agent_end"; t: string; runId: string; agent: string; turn: number; status: "ok" | "error" | "aborted"; durationMs: number }
  | { kind: "assistant_delta"; t: string; runId: string; agent: string; text: string }
  | { kind: "assistant_message"; t: string; runId: string; agent: string; text: string }
  | { kind: "tool_use"; t: string; runId: string; agent: string; tool: string; input?: unknown; id?: string }
  | { kind: "tool_result"; t: string; runId: string; agent: string; tool?: string; ok: boolean; summary?: string; id?: string }
  | { kind: "usage"; t: string; runId: string; agent: string; usage: RunUsage }
  | { kind: "message"; t: string; runId: string; from: string; to: string; text: string }
  | { kind: "plan_artifact"; t: string; runId: string; agent: string; path: string; bytes: number }
  | { kind: "teammate_spawned"; t: string; runId: string; teammate: string; agentType?: string; status: "spawning" | "running" }
  | { kind: "teammate_idle"; t: string; runId: string; teammate: string; result?: string }
  | { kind: "task_created"; t: string; runId: string; taskId: string; title: string; assignee?: string }
  | { kind: "task_completed"; t: string; runId: string; taskId: string; title: string; assignee?: string }
  | { kind: "error"; t: string; runId: string; agent?: string; message: string }
  | { kind: "log"; t: string; runId: string; level: "info" | "warn" | "error"; message: string }
  | { kind: "run_end"; t: string; runId: string; status: RunStatus; totals: RunUsage };

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Summarize a value for a tool-result line. Large inputs get truncated so the
 * transcript stays readable and the JSONL file stays bounded.
 */
export function summarizeForTranscript(value: unknown, max = 240): string {
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= max) {
      return str;
    }
    return `${str.slice(0, max)}… (${str.length} chars)`;
  } catch {
    return "(unrepresentable)";
  }
}
