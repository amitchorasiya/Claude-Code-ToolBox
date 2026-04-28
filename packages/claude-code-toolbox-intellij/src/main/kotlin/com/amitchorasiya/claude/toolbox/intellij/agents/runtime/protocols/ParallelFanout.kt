package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger

fun parallelFanout(ctx: ProtocolContext, maxConcurrent: Int = 3): ProtocolResult {
    val totals = RunUsage()
    val roster = ctx.agents
    if (roster.isEmpty()) return ProtocolResult("error", totals)

    emitMessage(ctx.bus, "system", "all", "Phase 1: Fan-out — ${roster.size} agents working in parallel")
    ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "none", "none", false))

    val pool = Executors.newFixedThreadPool(maxConcurrent.coerceAtMost(roster.size))
    val turnCounter = AtomicInteger(0)
    val results = mutableListOf<Pair<String, String>>()

    try {
        val futures = mutableListOf<Future<Pair<String, TurnResult>>>()
        for (agent in roster) {
            futures.add(pool.submit<Pair<String, TurnResult>> {
                val turn = turnCounter.incrementAndGet()
                val prompt = "Team task: ${ctx.userPrompt}\n\nYou are \"${agent.name}\". Provide your complete perspective independently."
                val r = spawnAgentTurn(agent, prompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
                agent.name to r
            })
        }
        for (f in futures) {
            val (name, r) = f.get()
            if (r.aborted) return ProtocolResult("aborted", totals)
            if (!r.errored) results.add(name to r.text)
        }
    } finally {
        pool.shutdownNow()
    }

    if (results.isEmpty()) return ProtocolResult("error", totals)
    if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)

    emitMessage(ctx.bus, "system", "all", "Phase 2: Synthesis — merging ${results.size} responses")
    val judgeAgent = if (ctx.team.judge != null) findAgentByName(roster, ctx.team.judge) ?: roster[0] else roster[0]
    val transcript = describeTranscriptForJudge(results)
    val judgePrompt = "You are the synthesizer \"${judgeAgent.name}\".\n\nTeam task: ${ctx.userPrompt}\n\nAll team responses:\n$transcript\n\nProduce a single cohesive answer incorporating the best insights."
    val turn = turnCounter.incrementAndGet()
    val judgeResult = spawnAgentTurn(judgeAgent, judgePrompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
    if (judgeResult.aborted) return ProtocolResult("aborted", totals)
    return ProtocolResult(if (judgeResult.errored) "error" else "completed", totals)
}
