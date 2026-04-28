/**
 * Round-robin protocol — custom runtime.
 *
 * Agents speak in order, each seeing the previous agents' latest messages.
 * Wraps around until `maxTurns` total turns have been consumed or the signal
 * is aborted. Each agent emits a `message {from, to: next}` at the end of its
 * turn so the transcript shows the handoff clearly.
 */
import type { Protocol } from "../runtimeTypes";
import { emitMessage, findAgentByName, makeTotals, runOneTurn } from "./shared";

export const roundRobin: Protocol = async (ctx) => {
  const totals = makeTotals();
  const roster = ctx.team.agents
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (!roster.length) {
    return { status: "error", totals };
  }
  let history: { agent: string; text: string }[] = [];
  const max = Math.min(ctx.team.maxTurns || 10, roster.length * 8);
  for (let turn = 1; turn <= max && !ctx.signal.aborted; turn++) {
    const agent = roster[(turn - 1) % roster.length];
    const transcript = history
      .slice(-6)
      .map((h, i) => `${i + 1}. ${h.agent}: ${h.text}`)
      .join("\n");
    const prompt = [
      `Team round-robin turn ${turn}/${max}. Team task:`,
      "",
      ctx.userPrompt,
      "",
      transcript ? `Recent transcript:\n${transcript}` : "(you speak first)",
      "",
      `Respond in your role as "${agent.name}". Keep it focused; the next agent will continue the thread.`,
    ].join("\n");
    const { text, errored } = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent,
      prompt,
      runId: ctx.runId,
      turn,
      phase: "none",
      bus: ctx.bus,
      totals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });
    if (errored) {
      return { status: "error", totals };
    }
    history.push({ agent: agent.name, text });
    const next = roster[turn % roster.length];
    if (next && next.name !== agent.name) {
      emitMessage(ctx.bus, agent.name, next.name, text);
    }
  }
  return { status: ctx.signal.aborted ? "aborted" : "completed", totals };
};
