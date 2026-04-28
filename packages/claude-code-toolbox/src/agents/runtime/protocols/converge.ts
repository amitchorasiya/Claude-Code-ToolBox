/**
 * Converge protocol — parallel diverge → cross-pollinate → synthesize →
 * approve → code → judge review.
 *
 * Phase 1 (Diverge):  All plan agents think independently in parallel.
 * Phase 2 (Cross-pollinate): Each agent sees ALL prior outputs and refines.
 *   Runs in parallel. Repeats for N convergence rounds (team.maxTurns, 1–5).
 * Phase 3 (Synthesize): Judge reads full transcript from every round, produces
 *   a cohesive plan wrapped in <plan> tags. Writes plan.md artifact.
 * Phase 4 (Approve): User reviews the synthesized plan. Can edit before
 *   approving or reject to abort.
 * Phase 5 (Code): Code-phase agents execute the approved plan sequentially,
 *   each seeing prior code transcript.
 * Phase 6 (Judge review): Optional final judge pass on the code transcript.
 */
import type { AgentEntry } from "../../localAgents";
import type { Protocol } from "../runtimeTypes";
import { nowIso } from "../eventTypes";
import {
  addUsage,
  describeTranscriptForJudge,
  emitMessage,
  extractPlan,
  findAgentByName,
  makeTotals,
  runOneTurn,
  writePlanArtifact,
} from "./shared";

export type ConvergeOptions = {
  maxConcurrent: number;
};

type AgentResult = { agent: string; text: string; errored: boolean };

async function runParallelPhase(
  ctx: Parameters<Protocol>[0],
  roster: AgentEntry[],
  promptFn: (agent: AgentEntry) => string,
  turnOffset: number,
  phase: "plan" | "none",
  maxConcurrent: number,
  totals: ReturnType<typeof makeTotals>
): Promise<AgentResult[]> {
  const results = new Array<AgentResult>(roster.length);
  let nextIdx = 0;
  const workers: Promise<void>[] = [];
  const limit = Math.max(1, Math.min(maxConcurrent, roster.length));

  const workerLoop = async (): Promise<void> => {
    while (!ctx.signal.aborted) {
      const idx = nextIdx++;
      if (idx >= roster.length) return;
      const agent = roster[idx];
      const localTotals = makeTotals();
      const res = await runOneTurn({
        spawn: ctx.spawnAgentTurn,
        agent,
        prompt: promptFn(agent),
        runId: ctx.runId,
        turn: turnOffset + idx + 1,
        phase,
        bus: ctx.bus,
        totals: localTotals,
        cwd: ctx.cwd,
        signal: ctx.signal,
        claudeBin: ctx.claudeBin,
      });
      addUsage(totals, localTotals);
      results[idx] = { agent: agent.name, text: res.text, errored: res.errored };
    }
  };

  for (let i = 0; i < limit; i++) {
    workers.push(workerLoop());
  }
  await Promise.all(workers);
  return results.filter(Boolean);
}

function formatResults(results: AgentResult[]): string {
  return describeTranscriptForJudge(
    results
      .filter((r) => !r.errored)
      .map((r) => ({ agent: r.agent, text: r.text }))
  );
}

export function makeConverge(opts: ConvergeOptions): Protocol {
  return async (ctx) => {
    const totals = makeTotals();

    const roster = ctx.team.agents
      .map((n) => findAgentByName(ctx.agents, n))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
    if (!roster.length) {
      return { status: "error", totals };
    }
    const codeAgents = (ctx.team.codePhaseAgents || [])
      .map((n) => findAgentByName(ctx.agents, n))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);

    const judgeName = ctx.team.judge || roster[0].name;
    const judge = findAgentByName(ctx.agents, judgeName) || roster[0];
    const convergenceRounds = Math.max(1, Math.min(ctx.team.maxTurns || 1, 5));
    let turn = 0;

    // Accumulate ALL round results for the full transcript fed to the judge.
    const allRoundResults: AgentResult[][] = [];

    // ── Phase 1: Diverge ──
    ctx.bus.emit({
      kind: "phase_boundary",
      t: nowIso(),
      runId: ctx.runId,
      from: "none",
      to: "plan",
      needsApproval: false,
    });
    emitMessage(ctx.bus, "converge", "team", "Phase 1: Diverge -- all agents thinking independently");

    const divergeResults = await runParallelPhase(
      ctx,
      roster,
      (agent) =>
        [
          "Converge protocol -- Phase 1: Independent thinking.",
          "Every agent on the team is answering this task independently. No one can see others' work.",
          "",
          "Team task:",
          ctx.userPrompt,
          "",
          `You are "${agent.name}" (${agent.role}). Provide your complete perspective on this task.`,
          "Think deeply and be thorough -- your teammates will see your response in the next phase.",
        ].join("\n"),
      turn,
      "plan",
      opts.maxConcurrent,
      totals
    );
    turn += roster.length;
    allRoundResults.push(divergeResults);

    const activeAfterDiverge = divergeResults.filter((r) => !r.errored);
    if (!activeAfterDiverge.length) {
      return { status: "error", totals };
    }
    if (ctx.signal.aborted) {
      return { status: "aborted", totals };
    }

    // ── Phase 2: Cross-pollinate ──
    let previousRoundResults = divergeResults;

    for (let r = 1; r <= convergenceRounds; r++) {
      if (ctx.signal.aborted) {
        return { status: "aborted", totals };
      }

      ctx.bus.emit({
        kind: "phase_boundary",
        t: nowIso(),
        runId: ctx.runId,
        from: "plan",
        to: "plan",
        needsApproval: false,
      });
      emitMessage(
        ctx.bus,
        "converge",
        "team",
        `Phase 2: Cross-pollinate round ${r}/${convergenceRounds}`
      );

      const merged = formatResults(previousRoundResults);
      const activeRoster = roster.filter((a) =>
        previousRoundResults.some((pr) => pr.agent === a.name && !pr.errored)
      );
      if (!activeRoster.length) break;

      const roundResults = await runParallelPhase(
        ctx,
        activeRoster,
        (agent) =>
          [
            `Converge protocol -- Phase 2: Cross-pollination (round ${r}/${convergenceRounds}).`,
            "",
            "Team task:",
            ctx.userPrompt,
            "",
            "All teammates' responses from the previous round:",
            merged,
            "",
            `You are "${agent.name}" (${agent.role}).`,
            "Review your teammates' perspectives above. Write a refined response that:",
            "- Incorporates valid insights from peers",
            "- Addresses or rebuts points you disagree with",
            "- Strengthens your own reasoning where warranted",
            "Do NOT simply summarize -- advance the discussion.",
          ].join("\n"),
        turn,
        "plan",
        opts.maxConcurrent,
        totals
      );
      turn += activeRoster.length;
      allRoundResults.push(roundResults);
      previousRoundResults = roundResults;
    }

    if (ctx.signal.aborted) {
      return { status: "aborted", totals };
    }

    // ── Phase 3: Synthesize ──
    ctx.bus.emit({
      kind: "phase_boundary",
      t: nowIso(),
      runId: ctx.runId,
      from: "plan",
      to: "plan",
      needsApproval: false,
    });
    emitMessage(ctx.bus, "converge", judge.name, "Phase 3: Synthesize -- judge producing final plan");

    // Build full transcript from ALL rounds (diverge + every cross-pollination round).
    const fullRounds: { agent: string; text: string }[] = [];
    for (const roundGroup of allRoundResults) {
      for (const r of roundGroup) {
        if (!r.errored) fullRounds.push({ agent: r.agent, text: r.text });
      }
    }
    const fullTranscript = describeTranscriptForJudge(fullRounds);

    turn += 1;
    const synthPrompt = [
      `You are the synthesizer ("${judge.name}"). Your team used a converge protocol to think deeply about this task.`,
      "",
      "Team task:",
      ctx.userPrompt,
      "",
      "Full transcript from all phases (diverge + cross-pollination rounds):",
      fullTranscript,
      "",
      "Produce a single, cohesive plan that:",
      "- Resolves disagreements with clear reasoning",
      "- Incorporates the strongest insights from each contributor",
      "- Is actionable, specific, and complete",
      "",
      "You MUST wrap your final plan in <plan>...</plan> tags. The user will review and approve it before code runs.",
    ].join("\n");

    const synthRes = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent: judge,
      prompt: synthPrompt,
      runId: ctx.runId,
      turn,
      phase: "plan",
      bus: ctx.bus,
      totals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });

    if (synthRes.errored) {
      return { status: "error", totals };
    }

    let planMd = extractPlan(synthRes.text);
    const planPath = await writePlanArtifact(ctx.runDir, planMd, ctx.bus, judge.name);

    // ── Phase 4: Approval gate ──
    if (!ctx.awaitApproval) {
      ctx.bus.emit({
        kind: "log",
        t: nowIso(),
        runId: ctx.runId,
        level: "warn",
        message: "No approval handler wired; auto-approving the plan.",
      });
    }
    ctx.bus.emit({
      kind: "phase_boundary",
      t: nowIso(),
      runId: ctx.runId,
      from: "plan",
      to: "code",
      needsApproval: true,
      planPath,
    });

    let approval: {
      decision: "approve" | "reject";
      reason?: string;
      editedPlan?: string;
    } = { decision: "approve" };
    if (ctx.awaitApproval) {
      approval = await ctx.awaitApproval(planPath);
    }
    if (approval.decision === "reject" || ctx.signal.aborted) {
      ctx.bus.emit({
        kind: "log",
        t: nowIso(),
        runId: ctx.runId,
        level: "info",
        message: `Plan rejected${approval.reason ? `: ${approval.reason}` : ""}`,
      });
      return { status: "aborted", totals, planArtifactPath: planPath };
    }
    if (approval.editedPlan && approval.editedPlan.trim()) {
      planMd = approval.editedPlan.trim();
      await writePlanArtifact(ctx.runDir, planMd, ctx.bus, `${judge.name}+user`);
    }

    // ── Phase 5: Code execution ──
    const phaseAgents = codeAgents.length ? codeAgents : roster;
    const codeTranscript: { agent: string; text: string }[] = [];

    for (const agent of phaseAgents) {
      if (ctx.signal.aborted) {
        return { status: "aborted", totals, planArtifactPath: planPath };
      }
      turn += 1;
      const prior = codeTranscript.length
        ? describeTranscriptForJudge(codeTranscript)
        : "(you are the first code-phase agent)";
      const prompt = [
        `CODE PHASE, turn ${codeTranscript.length + 1}/${phaseAgents.length}. Team task:`,
        "",
        ctx.userPrompt,
        "",
        "APPROVED PLAN (follow exactly -- do NOT rewrite):",
        "",
        planMd,
        "",
        `Prior code transcript:\n${prior}`,
        "",
        `You are "${agent.name}" (${agent.role}). Execute your slice of the plan. Ship small, reviewable edits; announce what you changed.`,
      ].join("\n");
      const res = await runOneTurn({
        spawn: ctx.spawnAgentTurn,
        agent,
        prompt,
        runId: ctx.runId,
        turn,
        phase: "code",
        bus: ctx.bus,
        totals,
        cwd: ctx.cwd,
        signal: ctx.signal,
        claudeBin: ctx.claudeBin,
      });
      if (res.errored) {
        return { status: "error", totals, planArtifactPath: planPath };
      }
      codeTranscript.push({ agent: agent.name, text: res.text });
      const nextIdx = phaseAgents.findIndex((a) => a.name === agent.name) + 1;
      if (nextIdx < phaseAgents.length) {
        emitMessage(ctx.bus, agent.name, phaseAgents[nextIdx].name, res.text);
      }
    }

    // ── Phase 6: Optional judge review of code ──
    if (ctx.team.judge) {
      const codeJudge = findAgentByName(ctx.agents, ctx.team.judge);
      if (codeJudge) {
        turn += 1;
        const judgePrompt = [
          `FINAL REVIEW. You are "${codeJudge.name}".`,
          "",
          "Approved plan:",
          "",
          planMd,
          "",
          "Code-phase transcript:",
          describeTranscriptForJudge(codeTranscript),
          "",
          "Verify the plan was executed. Reply with APPROVE or REQUEST_CHANGES plus a 1-paragraph explanation.",
        ].join("\n");
        const jr = await runOneTurn({
          spawn: ctx.spawnAgentTurn,
          agent: codeJudge,
          prompt: judgePrompt,
          runId: ctx.runId,
          turn,
          phase: "code",
          bus: ctx.bus,
          totals,
          cwd: ctx.cwd,
          signal: ctx.signal,
          claudeBin: ctx.claudeBin,
        });
        if (jr.errored) {
          return { status: "error", totals, planArtifactPath: planPath };
        }
      }
    }

    return { status: "completed", totals, planArtifactPath: planPath };
  };
}
