package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.AgentEntry
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

private data class AgentResult(val agent: String, val text: String, val errored: Boolean)

private fun runParallelPhase(
    ctx: ProtocolContext, roster: List<AgentEntry>, promptFn: (AgentEntry) -> String,
    turnOffset: AtomicInteger, phase: RunPhase, maxConcurrent: Int, totals: RunUsage,
): List<AgentResult> {
    val pool = Executors.newFixedThreadPool(maxConcurrent.coerceAtMost(roster.size).coerceAtLeast(1))
    val results = Array<AgentResult?>(roster.size) { null }
    try {
        val futures = roster.mapIndexed { idx, agent ->
            pool.submit {
                if (ctx.abortFlag.get()) return@submit
                val turn = turnOffset.incrementAndGet()
                val r = spawnAgentTurn(agent, promptFn(agent), ctx.runId, turn, phase, ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
                results[idx] = AgentResult(agent.name, r.text, r.errored)
            }
        }
        for (f in futures) f.get()
    } finally {
        pool.shutdownNow()
    }
    return results.filterNotNull()
}

private fun formatResults(results: List<AgentResult>): String =
    describeTranscriptForJudge(results.filter { !it.errored }.map { it.agent to it.text })

fun converge(ctx: ProtocolContext, maxConcurrent: Int = 3): ProtocolResult {
    val totals = RunUsage()
    val roster = ctx.team.agents.mapNotNull { findAgentByName(ctx.agents, it) }
    if (roster.isEmpty()) return ProtocolResult("error", totals)
    val codeAgents = ctx.team.codePhaseAgents.mapNotNull { findAgentByName(ctx.agents, it) }
    val judge = (if (ctx.team.judge != null) findAgentByName(ctx.agents, ctx.team.judge) else null) ?: roster[0]
    val convergenceRounds = ctx.team.maxTurns.coerceIn(1, 5)
    val turnCounter = AtomicInteger(0)
    val allRoundResults = mutableListOf<List<AgentResult>>()

    // Phase 1: Diverge
    ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "none", "plan", false))
    emitMessage(ctx.bus, "converge", "team", "Phase 1: Diverge — all agents thinking independently")

    val divergeResults = runParallelPhase(ctx, roster, { agent ->
        "Converge protocol — Phase 1: Independent thinking.\n" +
        "Every agent on the team is answering this task independently. No one can see others' work.\n\n" +
        "Team task:\n${ctx.userPrompt}\n\n" +
        "You are \"${agent.name}\" (${agent.role.name.lowercase()}). Provide your complete perspective.\n" +
        "Think deeply — your teammates will see your response in the next phase."
    }, turnCounter, "plan", maxConcurrent, totals)
    allRoundResults.add(divergeResults)

    val activeAfterDiverge = divergeResults.filter { !it.errored }
    if (activeAfterDiverge.isEmpty()) return ProtocolResult("error", totals)
    if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)

    // Phase 2: Cross-pollinate
    var previousResults = divergeResults
    for (r in 1..convergenceRounds) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "plan", "plan", false))
        emitMessage(ctx.bus, "converge", "team", "Phase 2: Cross-pollinate round $r/$convergenceRounds")

        val merged = formatResults(previousResults)
        val activeRoster = roster.filter { a -> previousResults.any { it.agent == a.name && !it.errored } }
        if (activeRoster.isEmpty()) break

        val roundResults = runParallelPhase(ctx, activeRoster, { agent ->
            "Converge protocol — Phase 2: Cross-pollination (round $r/$convergenceRounds).\n\n" +
            "Team task:\n${ctx.userPrompt}\n\n" +
            "All teammates' responses from the previous round:\n$merged\n\n" +
            "You are \"${agent.name}\" (${agent.role.name.lowercase()}).\n" +
            "Review your teammates' perspectives above. Write a refined response that:\n" +
            "- Incorporates valid insights from peers\n" +
            "- Addresses or rebuts points you disagree with\n" +
            "- Strengthens your own reasoning where warranted\n" +
            "Do NOT simply summarize — advance the discussion."
        }, turnCounter, "plan", maxConcurrent, totals)
        allRoundResults.add(roundResults)
        previousResults = roundResults
    }
    if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)

    // Phase 3: Synthesize
    ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "plan", "plan", false))
    emitMessage(ctx.bus, "converge", judge.name, "Phase 3: Synthesize — judge producing final plan")

    val fullRounds = allRoundResults.flatMap { group -> group.filter { !it.errored }.map { it.agent to it.text } }
    val fullTranscript = describeTranscriptForJudge(fullRounds)
    val synthTurn = turnCounter.incrementAndGet()

    val synthPrompt = "You are the synthesizer (\"${judge.name}\"). Your team used a converge protocol.\n\n" +
        "Team task:\n${ctx.userPrompt}\n\n" +
        "Full transcript from all phases:\n$fullTranscript\n\n" +
        "Produce a single, cohesive plan that resolves disagreements, incorporates strongest insights, and is actionable.\n" +
        "You MUST wrap your final plan in <plan>...</plan> tags."

    val synthResult = spawnAgentTurn(judge, synthPrompt, ctx.runId, synthTurn, "plan", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
    if (synthResult.errored) return ProtocolResult("error", totals)

    var planMd = extractPlan(synthResult.text)
    val planPath = writePlanArtifact(ctx.runDir, planMd, ctx.bus, judge.name)

    // Phase 4: Approval gate
    ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "plan", "code", true, planPath))
    if (ctx.awaitApproval != null) {
        val (decision, reason) = ctx.awaitApproval.invoke(planPath)
        if (decision == "reject" || ctx.abortFlag.get()) {
            emitMessage(ctx.bus, "user", "system", "Plan rejected${if (reason != null) ": $reason" else ""}")
            return ProtocolResult("aborted", totals, planPath)
        }
    }

    // Phase 5: Code execution
    val phaseAgents = codeAgents.ifEmpty { roster }
    val codeTranscript = mutableListOf<Pair<String, String>>()

    for (agent in phaseAgents) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals, planPath)
        val codeTurn = turnCounter.incrementAndGet()
        val prior = if (codeTranscript.isEmpty()) "(you are the first code-phase agent)" else describeTranscriptForJudge(codeTranscript)
        val prompt = "CODE PHASE, turn ${codeTranscript.size + 1}/${phaseAgents.size}. Team task:\n\n${ctx.userPrompt}\n\n" +
            "APPROVED PLAN (follow exactly):\n\n$planMd\n\n" +
            "Prior code transcript:\n$prior\n\n" +
            "You are \"${agent.name}\" (${agent.role.name.lowercase()}). Execute your slice of the plan."
        val result = spawnAgentTurn(agent, prompt, ctx.runId, codeTurn, "code", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        if (result.errored) return ProtocolResult("error", totals, planPath)
        codeTranscript.add(agent.name to result.text)
    }

    // Phase 6: Judge review
    if (ctx.team.judge != null) {
        val codeJudge = findAgentByName(ctx.agents, ctx.team.judge)
        if (codeJudge != null && !ctx.abortFlag.get()) {
            val reviewTurn = turnCounter.incrementAndGet()
            val judgePrompt = "FINAL REVIEW. You are \"${codeJudge.name}\".\n\n" +
                "Approved plan:\n\n$planMd\n\n" +
                "Code-phase transcript:\n${describeTranscriptForJudge(codeTranscript)}\n\n" +
                "Verify the plan was executed. Reply with APPROVE or REQUEST_CHANGES plus explanation."
            val jr = spawnAgentTurn(codeJudge, judgePrompt, ctx.runId, reviewTurn, "code", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
            if (jr.errored) return ProtocolResult("error", totals, planPath)
        }
    }

    return ProtocolResult("completed", totals, planPath)
}
