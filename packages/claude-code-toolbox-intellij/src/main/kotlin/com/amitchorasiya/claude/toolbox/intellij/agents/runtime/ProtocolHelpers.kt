package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import com.amitchorasiya.claude.toolbox.intellij.agents.AgentEntry
import java.io.File

fun emitMessage(bus: RunBus, from: String, to: String, text: String) {
    bus.emit(AgentRunEvent.Message(nowIso(), bus.runId, from, to, text))
}

fun findAgentByName(list: List<AgentEntry>, name: String): AgentEntry? =
    list.find { it.name == name }

fun describeTranscriptForJudge(rounds: List<Pair<String, String>>): String =
    rounds.mapIndexed { i, (agent, text) -> "### Turn ${i + 1} — $agent\n\n${text.trim()}" }.joinToString("\n\n")

fun extractPlan(message: String): String {
    val m = Regex("<plan>([\\s\\S]*?)</plan>", RegexOption.IGNORE_CASE).find(message)
    return m?.groupValues?.get(1)?.trim() ?: message.trim()
}

fun writePlanArtifact(runDir: String, planMd: String, bus: RunBus, authorAgent: String, filename: String = "plan.md"): String {
    val dir = File(runDir)
    if (!dir.exists()) dir.mkdirs()
    val planPath = File(dir, filename).absolutePath
    File(planPath).writeText(if (planMd.endsWith("\n")) planMd else "$planMd\n")
    bus.emit(AgentRunEvent.PlanArtifact(nowIso(), bus.runId, authorAgent, planPath, planMd.toByteArray().size))
    return planPath
}

data class ProtocolResult(
    val status: String,
    val totals: RunUsage,
    val planArtifactPath: String? = null,
)

data class ProtocolContext(
    val team: com.amitchorasiya.claude.toolbox.intellij.agents.TeamEntry,
    val agents: List<AgentEntry>,
    val userPrompt: String,
    val bus: RunBus,
    val runId: String,
    val cwd: String?,
    val abortFlag: java.util.concurrent.atomic.AtomicBoolean,
    val claudeBin: String?,
    val runDir: String,
    val awaitApproval: ((planPath: String) -> Pair<String, String?>)? = null,
)
