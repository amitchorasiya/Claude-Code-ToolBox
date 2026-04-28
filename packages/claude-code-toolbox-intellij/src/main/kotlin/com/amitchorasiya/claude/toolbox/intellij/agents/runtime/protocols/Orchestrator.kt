package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*

private val ROUTE_RE = Regex("ROUTE\\s*->\\s*(\\S+)", RegexOption.IGNORE_CASE)

fun orchestrator(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val maxTurns = ctx.team.maxTurns
    val roster = ctx.agents
    if (roster.isEmpty()) return ProtocolResult("error", totals)

    val lead = if (ctx.team.orchestrator != null) findAgentByName(roster, ctx.team.orchestrator) ?: roster[0] else roster[0]
    val specialists = roster.filter { it.name != lead.name }
    var turn = 0
    var leadPrompt = "Team task: ${ctx.userPrompt}\n\nYou are the orchestrator \"${lead.name}\". Available specialists: ${specialists.joinToString { it.name }}.\nAnalyze the task and either solve it yourself or route to a specialist with ROUTE -> <name>."

    while (turn < maxTurns) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        turn++
        val result = spawnAgentTurn(lead, leadPrompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        if (result.aborted) return ProtocolResult("aborted", totals)
        val m = ROUTE_RE.find(result.text) ?: break
        val spec = findAgentByName(specialists, m.groupValues[1]) ?: break
        emitMessage(ctx.bus, lead.name, spec.name, "ROUTE -> ${spec.name}")
        turn++
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        val specResult = spawnAgentTurn(spec, "Team task: ${ctx.userPrompt}\n\nThe orchestrator asked you to handle this. Their analysis:\n${result.text.take(2000)}", ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        if (specResult.aborted) return ProtocolResult("aborted", totals)
        leadPrompt = "Specialist \"${spec.name}\" replied:\n${specResult.text.take(2000)}\n\nContinue orchestrating or produce the final answer."
    }
    return ProtocolResult("completed", totals)
}
