/**
 * Parallel fan-out protocol — dispatch the same task to every agent at once,
 * then have the first listed agent synthesize a merged answer from their peers.
 *
 * Respects `agentTeams.maxConcurrentAgents` via an internal worker-pool so we
 * never blow past the configured concurrency cap (wired in runOrchestrator).
 */
import type { Protocol } from "../runtimeTypes";
import { addUsage, emitMessage, findAgentByName, makeTotals, runOneTurn } from "./shared";

export type ParallelFanoutOptions = {
  maxConcurrent: number;
};

export function makeParallelFanout(opts: ParallelFanoutOptions): Protocol {
  return async (ctx) => {
    const totals = makeTotals();
    const roster = ctx.team.agents
      .map((n) => findAgentByName(ctx.agents, n))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
    if (!roster.length) {
      return { status: "error", totals };
    }
    const synthesizer = roster[0];
    const results = new Array<string>(roster.length);
    let nextIdx = 0;
    const workers: Promise<void>[] = [];
    const limit = Math.max(1, Math.min(opts.maxConcurrent, roster.length));
    let sharedError = false;

    const workerLoop = async (): Promise<void> => {
      while (!sharedError && !ctx.signal.aborted) {
        const idx = nextIdx++;
        if (idx >= roster.length) {
          return;
        }
        const agent = roster[idx];
        const prompt = [
          `Parallel fan-out: every agent on the team is answering this task independently.`,
          `Team task:`,
          ctx.userPrompt,
          "",
          `You are "${agent.name}" (${agent.role}). Answer from your perspective only. Keep it self-contained.`,
        ].join("\n");
        const localTotals = makeTotals();
        const res = await runOneTurn({
          spawn: ctx.spawnAgentTurn,
          agent,
          prompt,
          runId: ctx.runId,
          turn: idx + 1,
          phase: "none",
          bus: ctx.bus,
          totals: localTotals,
          cwd: ctx.cwd,
          signal: ctx.signal,
          claudeBin: ctx.claudeBin,
        });
        addUsage(totals, localTotals);
        if (res.errored) {
          sharedError = true;
          return;
        }
        results[idx] = res.text;
      }
    };

    for (let i = 0; i < limit; i++) {
      workers.push(workerLoop());
    }
    await Promise.all(workers);

    if (sharedError) {
      return { status: "error", totals };
    }
    if (ctx.signal.aborted) {
      return { status: "aborted", totals };
    }

    const merged = roster
      .map((a, i) => `### ${a.name} (${a.role})\n\n${(results[i] || "(no response)").trim()}`)
      .join("\n\n");
    emitMessage(ctx.bus, "fan-out", synthesizer.name, "all peer responses forwarded for synthesis");
    const synthPrompt = [
      `You are "${synthesizer.name}". Your teammates answered the same task in parallel.`,
      `Synthesize a single merged answer that cites or resolves any disagreements.`,
      "",
      `Team task:`,
      ctx.userPrompt,
      "",
      `Peer responses:`,
      merged,
    ].join("\n");
    const synthTotals = makeTotals();
    const synthRes = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent: synthesizer,
      prompt: synthPrompt,
      runId: ctx.runId,
      turn: roster.length + 1,
      phase: "none",
      bus: ctx.bus,
      totals: synthTotals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });
    addUsage(totals, synthTotals);
    if (synthRes.errored) {
      return { status: "error", totals };
    }
    return { status: "completed", totals };
  };
}
