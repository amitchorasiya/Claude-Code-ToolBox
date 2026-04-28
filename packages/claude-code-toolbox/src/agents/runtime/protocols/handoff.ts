/**
 * Hand-off protocol — each agent decides who (if anyone) takes the next turn.
 *
 * The agent system-prompt wrapper instructs them to end with a `HANDOFF: name`
 * line (or `HANDOFF: done` to finish). We parse that line; if the named agent
 * exists in the team roster, we dispatch to them next, otherwise we stop.
 * This is a custom runtime because it requires inter-turn control flow that
 * native Task can't express as a protocol.
 */
import type { Protocol } from "../runtimeTypes";
import { emitMessage, findAgentByName, makeTotals, runOneTurn } from "./shared";

const HANDOFF_RE = /handoff:\s*([A-Za-z0-9._-]+)\s*$/im;

export const handoff: Protocol = async (ctx) => {
  const totals = makeTotals();
  const roster = ctx.team.agents
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (!roster.length) {
    return { status: "error", totals };
  }
  let current = roster[0];
  let lastMessage = "";
  const max = ctx.team.maxTurns || 12;
  for (let turn = 1; turn <= max && !ctx.signal.aborted; turn++) {
    const prompt = [
      `Team hand-off turn ${turn}/${max}. Team task:`,
      "",
      ctx.userPrompt,
      "",
      lastMessage ? `Previous agent said:\n${lastMessage}` : "(you speak first)",
      "",
      `Available teammates: ${roster.map((a) => a.name).filter((n) => n !== current.name).join(", ") || "(none)"}`,
      "",
      `You are "${current.name}". After your response, end with exactly one line:`,
      `HANDOFF: <teammate-name>  (to pass control)`,
      `HANDOFF: done             (when the task is finished)`,
    ].join("\n");
    const { text, errored } = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent: current,
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
    lastMessage = text;
    const match = text.match(HANDOFF_RE);
    if (!match || match[1].toLowerCase() === "done") {
      break;
    }
    const nextAgent = findAgentByName(roster, match[1]);
    if (!nextAgent || nextAgent.name === current.name) {
      break;
    }
    emitMessage(ctx.bus, current.name, nextAgent.name, text);
    current = nextAgent;
  }
  return { status: ctx.signal.aborted ? "aborted" : "completed", totals };
};
