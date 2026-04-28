package com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols

import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.*
import java.io.File

fun planThenCode(ctx: ProtocolContext): ProtocolResult {
    val totals = RunUsage()
    val roster = ctx.agents
    if (roster.isEmpty()) return ProtocolResult("error", totals)
    var turn = 0
    var planArtifactPath: String? = null

    // Phase 1: Plan
    emitMessage(ctx.bus, "system", "all", "Phase 1: Planning")
    ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "none", "plan", false))

    val planTranscript = mutableListOf<Pair<String, String>>()
    for (agent in roster) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals)
        turn++
        val prevContext = if (planTranscript.isEmpty()) "" else "\n\nPrevious team input:\n${describeTranscriptForJudge(planTranscript)}"
        val prompt = "Plan-then-code — planning phase.\n\nTask: ${ctx.userPrompt}$prevContext\n\nYou are \"${agent.name}\" (${agent.role.name.lowercase()}). Contribute your planning perspective. Wrap your plan in <plan>…</plan> tags."
        val result = spawnAgentTurn(agent, prompt, ctx.runId, turn, "plan", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        planTranscript.add(agent.name to result.text)
        if (result.aborted) return ProtocolResult("aborted", totals)
    }

    val lastPlanText = planTranscript.lastOrNull()?.second ?: ""
    val planMd = extractPlan(lastPlanText)
    if (planMd.isNotBlank()) {
        planArtifactPath = writePlanArtifact(ctx.runDir, planMd, ctx.bus, planTranscript.last().first)
    }

    // Phase 2: Approval gate
    if (ctx.awaitApproval != null && planArtifactPath != null) {
        emitMessage(ctx.bus, "system", "user", "Plan ready — awaiting approval")
        ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "plan", "code", true, planArtifactPath))
        val (decision, reason) = ctx.awaitApproval.invoke(planArtifactPath)
        if (decision == "reject") {
            emitMessage(ctx.bus, "user", "system", "Plan rejected${if (reason != null) ": $reason" else ""}")
            return ProtocolResult("aborted", totals, planArtifactPath)
        }
        emitMessage(ctx.bus, "user", "system", "Plan approved")
    } else {
        ctx.bus.emit(AgentRunEvent.PhaseBoundary(nowIso(), ctx.runId, "plan", "code", false))
    }

    // Phase 3: Code
    emitMessage(ctx.bus, "system", "all", "Phase 2: Code execution")
    val codeAgents = if (ctx.team.codePhaseAgents.isNotEmpty()) {
        ctx.team.codePhaseAgents.mapNotNull { findAgentByName(ctx.agents, it) }.ifEmpty { roster }
    } else roster

    val planContent = if (planArtifactPath != null) try { File(planArtifactPath).readText() } catch (_: Exception) { planMd } else planMd
    val codeTranscript = mutableListOf<Pair<String, String>>()
    for (agent in codeAgents) {
        if (ctx.abortFlag.get()) return ProtocolResult("aborted", totals, planArtifactPath)
        turn++
        val prevCode = if (codeTranscript.isEmpty()) "" else "\n\nPrevious work:\n${describeTranscriptForJudge(codeTranscript)}"
        val prompt = "Plan-then-code — code phase.\n\nOriginal task: ${ctx.userPrompt}\n\nApproved plan:\n$planContent$prevCode\n\nYou are \"${agent.name}\". Implement your part of the plan."
        val result = spawnAgentTurn(agent, prompt, ctx.runId, turn, "code", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        codeTranscript.add(agent.name to result.text)
        if (result.aborted) return ProtocolResult("aborted", totals, planArtifactPath)
    }

    // Phase 4: Judge review (optional)
    if (ctx.team.judge != null) {
        val judge = findAgentByName(ctx.agents, ctx.team.judge)
        if (judge != null && !ctx.abortFlag.get()) {
            emitMessage(ctx.bus, "system", judge.name, "Final review")
            turn++
            val allWork = describeTranscriptForJudge(codeTranscript)
            val judgePrompt = "You are the reviewer \"${judge.name}\".\n\nOriginal task: ${ctx.userPrompt}\nPlan:\n$planContent\n\nAll code-phase work:\n$allWork\n\nReview: does the implementation match the plan? Flag any gaps."
            spawnAgentTurn(judge, judgePrompt, ctx.runId, turn, "code", ctx.bus, totals, ctx.cwd, ctx.claudeBin, ctx.abortFlag)
        }
    }

    return ProtocolResult("completed", totals, planArtifactPath)
}
