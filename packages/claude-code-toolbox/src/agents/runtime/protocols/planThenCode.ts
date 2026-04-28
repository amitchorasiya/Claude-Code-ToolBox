/**
 * Plan-then-code — the flagship Phase-3 protocol.
 *
 * Flow:
 *   1. PLAN phase: plan agents run round-robin; final message must contain
 *      `<plan>…</plan>`; extracted to `plan.md`.
 *   2. Emit `phase_boundary {needsApproval:true}` and block via
 *      `ctx.awaitApproval(planPath)` — the host resolves this once the user
 *      clicks Approve (optionally with an edited plan).
 *   3. CODE phase: code agents run round-robin, each seeing the approved plan
 *      via --append-system-prompt. Judge (if present on team) runs a final
 *      review turn on the code transcript.
 *
 * If the user rejects, we emit `run_end` with status `aborted` (the reason is
 * surfaced as a `log` event first).
 */
import type { Protocol } from "../runtimeTypes";
import { nowIso } from "../eventTypes";
import {
  describeTranscriptForJudge,
  emitMessage,
  extractPlan,
  findAgentByName,
  makeTotals,
  runOneTurn,
  writePlanArtifact,
} from "./shared";

export const planThenCode: Protocol = async (ctx) => {
  const totals = makeTotals();
  const planAgents = ctx.team.agents
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  const codeAgents = (ctx.team.codePhaseAgents || [])
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (!planAgents.length) {
    return { status: "error", totals };
  }

  /* === PLAN PHASE === */
  ctx.bus.emit({
    kind: "phase_boundary",
    t: nowIso(),
    runId: ctx.runId,
    from: "none",
    to: "plan",
    needsApproval: false,
  });
  const planTranscript: { agent: string; text: string }[] = [];
  let turn = 0;
  for (const agent of planAgents) {
    if (ctx.signal.aborted) return { status: "aborted", totals };
    turn += 1;
    const prior = planTranscript.length
      ? describeTranscriptForJudge(planTranscript)
      : "(you open the plan discussion)";
    const isLast = turn === planAgents.length;
    const suffix = isLast
      ? `You are the LAST plan agent — your final message MUST wrap the agreed plan in <plan>…</plan> tags. Make the plan executable and specific; reviewers will approve it before any code runs.`
      : `Contribute your angle. Do NOT emit <plan> tags yet — the last agent will do that.`;
    const prompt = [
      `PLAN PHASE, turn ${turn}/${planAgents.length}. Team task:`,
      "",
      ctx.userPrompt,
      "",
      `Prior plan transcript:\n${prior}`,
      "",
      `You are "${agent.name}" (${agent.role}).`,
      suffix,
    ].join("\n");
    const res = await runOneTurn({
      spawn: ctx.spawnAgentTurn,
      agent,
      prompt,
      runId: ctx.runId,
      turn,
      phase: "plan",
      bus: ctx.bus,
      totals,
      cwd: ctx.cwd,
      signal: ctx.signal,
      claudeBin: ctx.claudeBin,
    });
    if (res.errored) return { status: "error", totals };
    planTranscript.push({ agent: agent.name, text: res.text });
  }
  const rawPlan = planTranscript[planTranscript.length - 1].text;
  let planMd = extractPlan(rawPlan);
  const lastAuthor = planTranscript[planTranscript.length - 1].agent;
  const planPath = await writePlanArtifact(ctx.runDir, planMd, ctx.bus, lastAuthor);

  /* === APPROVAL GATE === */
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
  let approval: { decision: "approve" | "reject"; reason?: string; editedPlan?: string } = {
    decision: "approve",
  };
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
    await writePlanArtifact(ctx.runDir, planMd, ctx.bus, `${lastAuthor}+user`);
  }

  /* === CODE PHASE === */
  const phaseAgents = codeAgents.length ? codeAgents : planAgents;
  const codeTranscript: { agent: string; text: string }[] = [];
  for (const agent of phaseAgents) {
    if (ctx.signal.aborted) return { status: "aborted", totals, planArtifactPath: planPath };
    turn += 1;
    const prior = codeTranscript.length
      ? describeTranscriptForJudge(codeTranscript)
      : "(you are the first code-phase agent)";
    const prompt = [
      `CODE PHASE, turn ${turn - planAgents.length}/${phaseAgents.length}. Team task:`,
      "",
      ctx.userPrompt,
      "",
      `APPROVED PLAN (follow exactly — do NOT rewrite):`,
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
    if (res.errored) return { status: "error", totals, planArtifactPath: planPath };
    codeTranscript.push({ agent: agent.name, text: res.text });
    const next = phaseAgents[phaseAgents.findIndex((a) => a.name === agent.name) + 1];
    if (next) {
      emitMessage(ctx.bus, agent.name, next.name, res.text);
    }
  }

  /* Optional judge pass — architect or team.judge reviews final code transcript. */
  if (ctx.team.judge) {
    const judge = findAgentByName(ctx.agents, ctx.team.judge);
    if (judge) {
      turn += 1;
      const judgePrompt = [
        `FINAL REVIEW. You are "${judge.name}".`,
        "",
        `Approved plan:`,
        "",
        planMd,
        "",
        `Code-phase transcript:`,
        describeTranscriptForJudge(codeTranscript),
        "",
        `Verify the plan was executed. Reply with APPROVE or REQUEST_CHANGES plus a 1-paragraph explanation.`,
      ].join("\n");
      const jr = await runOneTurn({
        spawn: ctx.spawnAgentTurn,
        agent: judge,
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
      if (jr.errored) return { status: "error", totals, planArtifactPath: planPath };
    }
  }

  return { status: "completed", totals, planArtifactPath: planPath };
};
