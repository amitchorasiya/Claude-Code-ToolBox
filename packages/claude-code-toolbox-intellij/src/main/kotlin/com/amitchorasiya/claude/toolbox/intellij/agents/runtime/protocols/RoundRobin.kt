package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*

fun roundRobin(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val maxTurns = ctx.team.maxTurns
    val roster = ctx.agents
    if (roster.isEmpty()) return ProtocolResult("error", totals)

    val history = mutableListOf<Pair<String, String>>()

    for (turn in 1..maxTurns) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        val agent = roster[(turn - 1) % roster.size]
        val contextWindow = history.takeLast(6)
        val prompt = buildString {
            append("Team task: ${ctx.userPrompt}\n\n")
            if (contextWindow.isNotEmpty()) {
                append("Recent conversation:\n")
                for ((name, text) in contextWindow) append("[$name]: ${text.take(600)}\n\n")
            }
            append("You are \"${agent.name}\". Respond with your contribution.")
        }
        val result = spawnAgentTurn(agent, prompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        history.add(agent.name to result.text)
        if (result.aborted) return ProtocolResult("aborted", totals)
    }
    return ProtocolResult("completed", totals)
}
