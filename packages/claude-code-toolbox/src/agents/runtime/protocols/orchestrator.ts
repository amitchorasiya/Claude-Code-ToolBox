/**
 * Orchestrator protocol — one "lead" agent decides routing explicitly.
 *
 * The orchestrator emits a `ROUTE: <name>` directive naming the next specialist
 * plus a task for them. We run that specialist, capture the result, and return
 * control to the orchestrator for another routing decision, until the
 * orchestrator emits `ROUTE: done`.
 *
 * This matches the "handoff primitive" UX from OpenAI Swarm / LangGraph —
 * explicit routing with visible arrows in the transcript.
 */
import type { Protocol } from "../runtimeTypes";
import { emitMessage, findAgentByName, makeTotals, runOneTurn } from "./shared";

const ROUTE_RE = /route:\s*([A-Za-z0-9._-]+)/i;

export const orchestrator: Protocol = async (ctx) => {
  const totals = makeTotals();
  const roster = ctx.team.agents
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  const leadName = ctx.team.orchestrator || roster[0]?.name;
  const lead = leadName ? findAgentByName(ctx.agents, leadName) : undefined;
  if (!lead) {
    return { status: "error", totals };
  }
  const specialists = roster.filter((a) => a.name !== lead.name);
  let lastResult = "";
  let turn = 0;
  const max = ctx.team.maxTurns || 14;
  while (turn < max && !ctx.signal.aborted) {
    turn += 1;
    const routePrompt = [
      `You are "${lead.name}", the orchestrator.`,
      `Team task:`,
      ctx.userPrompt,
      "",
      `Specialists available: ${specialists.map((a) => `${a.name} (${a.role})`).join(", ") || "(none)"}`,
      "",
      lastResult ? `Latest specialist result:\n${lastResult}` : "(no specialist has run yet)",
      "",
      `Decide the next step. Reply with one section only:`,
      `- A brief rationale (1-3 lines), THEN`,
      `- A final line of exactly one of:`,
      `    ROUTE: <specialist-name>  <short task for them>`,
      `    ROUTE: done               (when the goal is met)`,
    ].join("\n");
    const leadRes = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent: lead,
      prompt: routePrompt,
      runId: ctx.runId,
      turn,
      phase: "none",
      bus: ctx.bus,
      totals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });
    if (leadRes.errored) {
      return { status: "error", totals };
    }
    const match = leadRes.text.match(ROUTE_RE);
    if (!match || match[1].toLowerCase() === "done") {
      break;
    }
    const next = findAgentByName(roster, match[1]);
    if (!next || next.name === lead.name) {
      break;
    }
    const taskLine = leadRes.text.split("\n").map((l) => l.trim()).find((l) => ROUTE_RE.test(l)) || "";
    const extractedTask = taskLine.replace(ROUTE_RE, "").trim() || leadRes.text;
    emitMessage(ctx.bus, lead.name, next.name, extractedTask);
    turn += 1;
    if (turn > max) {
      break;
    }
    const specPrompt = [
      `You are "${next.name}" (${next.role}).`,
      `The orchestrator "${lead.name}" has routed this work item to you:`,
      "",
      extractedTask,
      "",
      `Team goal for context:`,
      ctx.userPrompt,
      "",
      `Do the work and reply with the deliverable. Keep it self-contained — the orchestrator will integrate it.`,
    ].join("\n");
    const specRes = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent: next,
      prompt: specPrompt,
      runId: ctx.runId,
      turn,
      phase: "none",
      bus: ctx.bus,
      totals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });
    if (specRes.errored) {
      return { status: "error", totals };
    }
    emitMessage(ctx.bus, next.name, lead.name, specRes.text);
    lastResult = `${next.name}: ${specRes.text}`;
  }
  return { status: ctx.signal.aborted ? "aborted" : "completed", totals };
};
