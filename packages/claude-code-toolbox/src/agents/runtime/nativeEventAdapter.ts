/**
 * Translates Claude Code native Agent Teams events (from stream-json output and
 * hook payloads) into ToolBox AgentRunEvent shapes that the RunBus and dashboard
 * already understand.
 *
 * This adapter lets the existing transcript UI, cost tracking, and dashboard
 * cards work seamlessly with native Agent Teams without the webview needing to
 * know which runtime produced the events.
 */
import type { AgentRunEvent, RunUsage } from "./eventTypes";
import { nowIso } from "./eventTypes";

export type NativeTeammateEvent = {
  type: string;
  teammate?: string;
  agentType?: string;
  taskId?: string;
  title?: string;
  assignee?: string;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  total_cost_usd?: number;
  message?: {
    content?: unknown[];
  };
  subtype?: string;
};

export function parseNativeTeamEvent(
  raw: Record<string, unknown>,
  runId: string
): AgentRunEvent[] {
  const out: AgentRunEvent[] = [];
  const t = nowIso();
  const type = typeof raw.type === "string" ? raw.type : "";
  const subtype = typeof raw.subtype === "string" ? raw.subtype : "";

  if (type === "teammate_spawned" || (type === "system" && subtype === "teammate_spawned")) {
    const teammate = typeof raw.teammate === "string" ? raw.teammate : "teammate";
    const agentType = typeof raw.agent_type === "string" ? raw.agent_type : undefined;
    out.push({
      kind: "teammate_spawned",
      t,
      runId,
      teammate,
      agentType,
      status: "running",
    });
    out.push({
      kind: "agent_start",
      t,
      runId,
      agent: teammate,
      turn: 0,
      phase: "none",
    });
    return out;
  }

  if (type === "teammate_idle" || (type === "system" && subtype === "teammate_idle")) {
    const teammate = typeof raw.teammate === "string" ? raw.teammate : "teammate";
    const result = typeof raw.result === "string" ? raw.result : undefined;
    out.push({
      kind: "teammate_idle",
      t,
      runId,
      teammate,
      result,
    });
    out.push({
      kind: "agent_end",
      t,
      runId,
      agent: teammate,
      turn: 0,
      status: "ok",
      durationMs: 0,
    });
    if (raw.usage && typeof raw.usage === "object") {
      const u = raw.usage as Record<string, unknown>;
      const usage: RunUsage = {
        inputTokens: typeof u.input_tokens === "number" ? u.input_tokens : 0,
        outputTokens: typeof u.output_tokens === "number" ? u.output_tokens : 0,
        costUsd: typeof raw.total_cost_usd === "number" ? raw.total_cost_usd : 0,
        cacheReadInputTokens: typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : undefined,
        cacheCreationInputTokens: typeof u.cache_creation_input_tokens === "number" ? u.cache_creation_input_tokens : undefined,
      };
      out.push({ kind: "usage", t, runId, agent: teammate, usage });
    }
    return out;
  }

  if (type === "task_created" || (type === "system" && subtype === "task_created")) {
    const taskId = typeof raw.task_id === "string" ? raw.task_id : `task-${Date.now()}`;
    const title = typeof raw.title === "string" ? raw.title : "Untitled task";
    const assignee = typeof raw.assignee === "string" ? raw.assignee : undefined;
    out.push({ kind: "task_created", t, runId, taskId, title, assignee });
    return out;
  }

  if (type === "task_completed" || (type === "system" && subtype === "task_completed")) {
    const taskId = typeof raw.task_id === "string" ? raw.task_id : `task-${Date.now()}`;
    const title = typeof raw.title === "string" ? raw.title : "";
    const assignee = typeof raw.assignee === "string" ? raw.assignee : undefined;
    out.push({ kind: "task_completed", t, runId, taskId, title, assignee });
    return out;
  }

  if (type === "assistant") {
    const teammate = typeof raw.teammate === "string" ? raw.teammate : "lead";
    const message = raw.message as { content?: unknown[] } | undefined;
    const content = Array.isArray(message?.content) ? message!.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        out.push({ kind: "assistant_delta", t, runId, agent: teammate, text: b.text });
      } else if (b.type === "tool_use") {
        const tool = typeof b.name === "string" ? b.name : "Tool";
        const id = typeof b.id === "string" ? b.id : undefined;
        out.push({ kind: "tool_use", t, runId, agent: teammate, tool, input: b.input, id });
      }
    }
    return out;
  }

  if (type === "result") {
    const teammate = typeof raw.teammate === "string" ? raw.teammate : "lead";
    const usage = raw.usage as Record<string, unknown> | undefined;
    const totals: RunUsage = {
      inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
      outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
      costUsd: typeof raw.total_cost_usd === "number" ? raw.total_cost_usd : 0,
      cacheReadInputTokens: typeof usage?.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : undefined,
      cacheCreationInputTokens: typeof usage?.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : undefined,
    };
    out.push({ kind: "usage", t, runId, agent: teammate, usage: totals });
    return out;
  }

  return out;
}

/**
 * Parse a hook event payload (from TeammateIdle, TaskCreated, TaskCompleted
 * hooks registered by the dashboard hookInstaller) and translate to RunBus events.
 */
export function parseHookPayload(
  hookName: string,
  payload: Record<string, unknown>,
  runId: string
): AgentRunEvent[] {
  const t = nowIso();

  switch (hookName) {
    case "TeammateIdle": {
      const teammate = typeof payload.teammate === "string" ? payload.teammate : "teammate";
      const result = typeof payload.result === "string" ? payload.result : undefined;
      return [
        { kind: "teammate_idle", t, runId, teammate, result },
        { kind: "agent_end", t, runId, agent: teammate, turn: 0, status: "ok", durationMs: 0 },
      ];
    }
    case "TaskCreated": {
      const taskId = typeof payload.task_id === "string" ? payload.task_id : `task-${Date.now()}`;
      const title = typeof payload.title === "string" ? payload.title : "Task";
      const assignee = typeof payload.assignee === "string" ? payload.assignee : undefined;
      return [{ kind: "task_created", t, runId, taskId, title, assignee }];
    }
    case "TaskCompleted": {
      const taskId = typeof payload.task_id === "string" ? payload.task_id : `task-${Date.now()}`;
      const title = typeof payload.title === "string" ? payload.title : "";
      const assignee = typeof payload.assignee === "string" ? payload.assignee : undefined;
      return [{ kind: "task_completed", t, runId, taskId, title, assignee }];
    }
    default:
      return [];
  }
}
