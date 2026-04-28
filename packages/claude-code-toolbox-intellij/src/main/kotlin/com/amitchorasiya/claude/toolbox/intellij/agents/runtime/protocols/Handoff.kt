package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*

private val HANDOFF_RE = Regex("HANDOFF\\s*->\\s*(\\S+)", RegexOption.IGNORE_CASE)

fun handoff(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val maxTurns = ctx.team.maxTurns
    val roster = ctx.agents
    if (roster.isEmpty()) return ProtocolResult("error", totals)

    var current = roster[0]
    var prompt = "Team task: ${ctx.userPrompt}\n\nYou are \"${current.name}\". Respond. If you need another agent, end your reply with HANDOFF -> <agent-name>."

    for (turn in 1..maxTurns) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        val result = spawnAgentTurn(current, prompt, ctx.runId, turn, "none", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        if (result.aborted) return ProtocolResult("aborted", totals)
        val m = HANDOFF_RE.find(result.text)
        if (m == null) break
        val nextName = m.groupValues[1]
        val next = findAgentByName(roster, nextName) ?: break
        emitMessage(ctx.bus, current.name, next.name, "HANDOFF -> ${next.name}")
        current = next
        prompt = "Team task: ${ctx.userPrompt}\n\nPrevious agent (${m.groupValues[0]}) handed off to you.\n\nYou are \"${current.name}\". Continue the work."
    }
    return ProtocolResult("completed", totals)
}
