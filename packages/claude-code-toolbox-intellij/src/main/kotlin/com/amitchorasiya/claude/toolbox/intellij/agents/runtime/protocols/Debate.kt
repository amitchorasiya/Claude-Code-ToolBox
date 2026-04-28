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
    val judgePrompt = "You are the judge \"${judge.name}\".\n\nDebate topic: ${ctx.userPrompt}\n\nFull transcript:\n$fullTranscript\n\nRender a verdict. Write your decision in <decision>…</decision> tags. Include strongest point from each side and a concrete next step."
    val judgeResult = spawnAgentTurn(judge, judgePrompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)

    val decisionText = extractPlan(judgeResult.text)
    if (decisionText.isNotBlank()) {
        writePlanArtifact(ctx.runDir, decisionText, ctx.bus, judge.name, "decision.md")
    }

    if (judgeResult.aborted) return ProtocolResult("aborted", totals)
    return ProtocolResult(if (judgeResult.errored) "error" else "completed", totals)
}
