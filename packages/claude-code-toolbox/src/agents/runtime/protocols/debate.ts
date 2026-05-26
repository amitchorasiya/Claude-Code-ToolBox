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
    `Write a DECISION between <decision>…</decision> tags. Inside the tags include ALL of:`,
    `1. **Per-agent summary**: For each participant, summarize their position, strongest argument, and any concessions they made.`,
    `2. **Key exchanges**: Identify the most important disagreements and how they were resolved (or not).`,
    `3. **Open questions**: List any unresolved issues, risks, or areas where the team did not reach consensus.`,
    `4. **Verdict**: State your final decision with clear reasoning.`,
    `5. **Next steps**: List concrete, actionable next steps.`,
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
  const verdictMd = m ? m[1].trim() : judgeRes.text.trim();

  // Build full decision.md with transcript + verdict
  const roundSize = participants.length;
  const transcriptSections: string[] = [];
  for (let r = 0; r < rounds; r++) {
    const roundEntries = transcript.slice(r * roundSize, (r + 1) * roundSize);
    if (!roundEntries.length) break;
    const lines = [`### Round ${r + 1}`];
    for (const entry of roundEntries) {
      lines.push("", `**${entry.agent}:**`, "", entry.text.trim());
    }
    transcriptSections.push(lines.join("\n"));
  }

  const fullDecision = [
    `# Debate Decision`,
    "",
    `**Task:** ${ctx.userPrompt.split("\n")[0].slice(0, 200)}`,
    `**Participants:** ${participants.map((p) => p.name).join(", ")}`,
    `**Judge:** ${judge.name}`,
    `**Rounds:** ${rounds}`,
    "",
    `---`,
    "",
    `## Debate Transcript`,
    "",
    ...transcriptSections,
    "",
    `---`,
    "",
    `## Judge's Verdict (${judge.name})`,
    "",
    verdictMd,
    "",
  ].join("\n");

  const decisionPath = await writePlanArtifact(ctx.runDir, fullDecision, ctx.bus, judge.name, "decision.md");
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
