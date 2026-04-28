package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*

fun nativeTask(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val agentNames = ctx.agents.map { it.name }
    val result = spawnClaudeSession(
        prompt = ctx.userPrompt, runId = ctx.runId, phase = "none",
        bus = ctx.bus, totals = totals, cwd = ctx.cwd, claudeBin = ctx.claudeBin,
        abortFlag = ctx.abortFlag, allowedAgents = agentNames,
    )
    val status = when {
        result.aborted -> "aborted"
        result.errored -> "error"
        else -> "completed"
    }
    return ProtocolResult(status, totals)
}
