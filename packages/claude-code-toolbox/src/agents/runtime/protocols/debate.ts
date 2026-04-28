/**
 * Debate protocol — N rounds of round-robin, then the judge reads the full
 * transcript and emits a verdict saved as `decision.md`.
 *
 * Each round all participants (other than the judge) get a chance to speak.
 * This is the "multi-agent debate" pattern popularized by research on
 * improving LLM reasoning through structured disagreement.
 */
import type { Protocol } from "../runtimeTypes";
import {
  describeTranscriptForJudge,
  emitMessage,
  findAgentByName,
  makeTotals,
  runOneTurn,
  writePlanArtifact,
} from "./shared";

export const debate: Protocol = async (ctx) => {
  const totals = makeTotals();
  const participants = ctx.team.agents
    .map((n) => findAgentByName(ctx.agents, n))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .filter((a) => a.name !== ctx.team.judge);
  if (!participants.length) {
    return { status: "error", totals };
  }
  const judgeName = ctx.team.judge || participants[0].name;
  const judge = findAgentByName(ctx.agents, judgeName) ?? participants[0];
  const rounds = Math.max(1, Math.min(ctx.team.maxTurns || 3, 8));
  const transcript: { agent: string; text: string }[] = [];
  let turn = 0;

  for (let r = 1; r <= rounds && !ctx.signal.aborted; r++) {
    for (const agent of participants) {
      if (ctx.signal.aborted) break;
      turn += 1;
      const prior = transcript.length
        ? describeTranscriptForJudge(transcript.slice(-participants.length * 2))
        : "(you open the debate)";
      const prompt = [
        `Debate round ${r}/${rounds}, turn ${turn}. Team task:`,
        "",
        ctx.userPrompt,
        "",
        prior ? `Prior transcript:\n\n${prior}` : "",
        "",
        `You are "${agent.name}" (${agent.role}). Argue your position concisely, address opposing points if any, and do NOT summarize — make progress.`,
      ].join("\n");
      const res = await runOneTurn({
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
      if (res.errored) {
        return { status: "error", totals };
      }
      transcript.push({ agent: agent.name, text: res.text });
    }
  }

  turn += 1;
  const judgePrompt = [
    `You are the judge ("${judge.name}"). The team just debated this task:`,
    "",
    ctx.userPrompt,
    "",
    `Full debate transcript:`,
    describeTranscriptForJudge(transcript),
    "",
    `Write a DECISION between <decision>…</decision> tags. Inside the tags:`,
    `- Summarize the strongest point from each side,`,
    `- State your verdict and why,`,
    `- List one concrete next step.`,
  ].join("\n");
  const judgeRes = await runOneTurn({
    spawn: ctx.spawnAgentTurn,
    agent: judge,
    prompt: judgePrompt,
    runId: ctx.runId,
    turn,
    phase: "none",
    bus: ctx.bus,
    totals,
    cwd: ctx.cwd,
    signal: ctx.signal,
    claudeBin: ctx.claudeBin,
  });
  if (judgeRes.errored) {
    return { status: "error", totals };
  }
  const m = judgeRes.text.match(/<decision>([\s\S]*?)<\/decision>/i);
  const decisionMd = (m ? m[1].trim() : judgeRes.text.trim()) + "\n";
  const decisionPath = await writePlanArtifact(ctx.runDir, decisionMd, ctx.bus, judge.name, "decision.md");
  emitMessage(ctx.bus, judge.name, "team", `Decision saved to ${decisionPath}`);

  /* Phase 1.6 — count dissent markers across participants' transcripts so the
   * dashboard can show a ⚖ badge with the disagreement tally. */
  let dissentCount = 0;
  const stanceRe = /\b(REVISE|REJECT|DISAGREE|BLOCK(?:ING)?|VETO|NO-GO)\b/i;
  for (const round of transcript) {
    if (stanceRe.test(round.text)) dissentCount += 1;
  }
  if (dissentCount > 0) {
    emitMessage(ctx.bus, judge.name, "team", `dissent:${dissentCount}`);
  }

  return { status: "completed", totals, planArtifactPath: decisionPath };
};
