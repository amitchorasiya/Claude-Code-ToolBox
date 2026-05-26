package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*

fun debate(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val roster = ctx.agents
    if (roster.size < 2) return ProtocolResult("error", totals)

    val maxRounds = ctx.team.maxTurns
    val debaters = roster.filter { it.name != ctx.team.judge }
    val judge = if (ctx.team.judge != null) findAgentByName(roster, ctx.team.judge) ?: roster.last() else roster.last()
    val transcript = mutableListOf<Pair<String, String>>()
    var turn = 0

    for (round in 1..maxRounds) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        emitMessage(ctx.bus, "system", "all", "Debate round $round/$maxRounds")
        ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "none", "none", false))

        for (agent in debaters) {
            if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
            turn++
            val prevContext = if (transcript.isEmpty()) "" else "\n\nPrevious contributions:\n${describeTranscriptForJudge(transcript)}"
            val prompt = "Debate — round $round/$maxRounds.\n\nTopic: ${ctx.userPrompt}$prevContext\n\nYou are \"${agent.name}\". Present your argument. Address points raised by others if any."
            val result = spawnAgentTurn(agent, prompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
            transcript.add(agent.name to result.text)
            if (result.aborted) return ProtocolResult("aborted", totals)
        }
    }

    if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
    emitMessage(ctx.bus, "system", judge.name, "Judge phase — rendering verdict")
    turn++
    val fullTranscript = describeTranscriptForJudge(transcript)
    val judgePrompt = buildString {
        append("You are the judge \"${judge.name}\".\n\n")
        append("Debate topic: ${ctx.userPrompt}\n\n")
        append("Full transcript:\n$fullTranscript\n\n")
        append("Write a DECISION between <decision>…</decision> tags. Inside the tags include ALL of:\n")
        append("1. **Per-agent summary**: For each participant, summarize their position, strongest argument, and any concessions they made.\n")
        append("2. **Key exchanges**: Identify the most important disagreements and how they were resolved (or not).\n")
        append("3. **Open questions**: List any unresolved issues, risks, or areas where the team did not reach consensus.\n")
        append("4. **Verdict**: State your final decision with clear reasoning.\n")
        append("5. **Next steps**: List concrete, actionable next steps.")
    }
    val judgeResult = spawnAgentTurn(judge, judgePrompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)

    val m = Regex("<decision>([\\s\\S]*?)</decision>", RegexOption.IGNORE_CASE).find(judgeResult.text)
    val verdictMd = (m?.groupValues?.get(1)?.trim() ?: judgeResult.text.trim())

    val roundSize = debaters.size
    val transcriptSections = mutableListOf<String>()
    for (r in 0 until maxRounds) {
        val roundEntries = transcript.drop(r * roundSize).take(roundSize)
        if (roundEntries.isEmpty()) break
        val lines = mutableListOf("### Round ${r + 1}")
        for ((name, text) in roundEntries) {
            lines.add(""); lines.add("**$name:**"); lines.add(""); lines.add(text.trim())
        }
        transcriptSections.add(lines.joinToString("\n"))
    }

    val taskLine = ctx.userPrompt.lines().firstOrNull()?.take(200) ?: ""
    val fullDecision = buildString {
        append("# Debate Decision\n\n")
        append("**Task:** $taskLine\n")
        append("**Participants:** ${debaters.joinToString(", ") { it.name }}\n")
        append("**Judge:** ${judge.name}\n")
        append("**Rounds:** $maxRounds\n\n")
        append("---\n\n")
        append("## Debate Transcript\n\n")
        append(transcriptSections.joinToString("\n\n"))
        append("\n\n---\n\n")
        append("## Judge's Verdict (${judge.name})\n\n")
        append(verdictMd)
        append("\n")
    }

    val decisionPath = writePlanArtifact(ctx.runDir, fullDecision, ctx.bus, judge.name, "decision.md")

    if (judgeResult.aborted) return ProtocolResult("aborted", totals)
    return ProtocolResult(if (judgeResult.errored) "error" else "completed", totals, planArtifactPath = decisionPath)
}
