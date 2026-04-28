/**
 * Native-task protocol — the simplest runtime.
 *
 * Fires a single `claude` session with the user prompt. Claude itself decides
 * which subagents (if any) to dispatch via the Task tool. We stream the
 * session's stream-json to the bus; the parser in claudeSpawn turns Task-tool
 * invocations into `agent_start` events so the UI still shows "agent X is
 * running" even though there's just one process.
 */
import type { Protocol } from "../runtimeTypes";
import { nowIso } from "../eventTypes";
import { addUsage, makeTotals } from "./shared";

export const nativeTask: Protocol = async (ctx) => {
  const totals = makeTotals();
  ctx.bus.emit({
    kind: "agent_start",
    t: nowIso(),
    runId: ctx.runId,
    agent: "main",
    turn: 1,
    phase: "none",
  });
  let errored = false;
  try {
    for await (const ev of ctx.spawnSession({
      prompt: ctx.userPrompt,
      runId: ctx.runId,
      phase: "none",
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
      allowedAgents: ctx.team.agents,
    })) {
      ctx.bus.emit(ev);
      if (ev.kind === "usage") {
        addUsage(totals, ev.usage);
      }
      if (ev.kind === "error") {
        errored = true;
      }
    }
  } catch (e) {
    errored = true;
    ctx.bus.emit({
      kind: "error",
      t: nowIso(),
      runId: ctx.runId,
      agent: "main",
      message: e instanceof Error ? e.message : String(e),
    });
  }
  ctx.bus.emit({
    kind: "agent_end",
    t: nowIso(),
    runId: ctx.runId,
    agent: "main",
    turn: 1,
    status: ctx.signal.aborted ? "aborted" : errored ? "error" : "ok",
    durationMs: 0,
  });
  return {
    status: ctx.signal.aborted ? "aborted" : errored ? "error" : "completed",
    totals,
  };
};
