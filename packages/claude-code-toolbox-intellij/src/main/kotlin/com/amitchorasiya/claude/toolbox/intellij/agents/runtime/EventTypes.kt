package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import com.google.gson.JsonObject
import java.time.Instant

typealias RunPhase = String   // "none" | "plan" | "code"
typealias RunStatus = String  // "running" | "awaiting_approval" | "completed" | "aborted" | "error"

data class RunUsage(
    var inputTokens: Long = 0,
    var outputTokens: Long = 0,
    var costUsd: Double = 0.0,
) {
    fun add(other: RunUsage) {
        inputTokens += other.inputTokens
        outputTokens += other.outputTokens
        costUsd += other.costUsd
    }
}

fun nowIso(): String = Instant.now().toString()

fun summarizeForTranscript(value: String, max: Int = 240): String {
    if (value.length <= max) return value
    return "${value.take(max)}… (${value.length} chars)"
}

sealed class AgentRunEvent {
    abstract val kind: String
    abstract val t: String
    abstract val runId: String

    fun toJson(): JsonObject {
        val o = JsonObject()
        o.addProperty("kind", kind)
        o.addProperty("t", t)
        o.addProperty("runId", runId)
        fillJson(o)
        return o
    }

    protected abstract fun fillJson(o: JsonObject)

    data class RunStart(override val t: String, override val runId: String, val teamId: String, val teamName: String, val protocol: String, val runtime: String, val phase: RunPhase) : AgentRunEvent() {
        override val kind = "run_start"
        override fun fillJson(o: JsonObject) { o.addProperty("teamId", teamId); o.addProperty("teamName", teamName); o.addProperty("protocol", protocol); o.addProperty("runtime", runtime); o.addProperty("phase", phase) }
    }
    data class PhaseBoundary(override val t: String, override val runId: String, val from: RunPhase, val to: RunPhase, val needsApproval: Boolean, val planPath: String? = null) : AgentRunEvent() {
        override val kind = "phase_boundary"
        override fun fillJson(o: JsonObject) { o.addProperty("from", from); o.addProperty("to", to); o.addProperty("needsApproval", needsApproval); if (planPath != null) o.addProperty("planPath", planPath) }
    }
    data class AgentStart(override val t: String, override val runId: String, val agent: String, val color: String? = null, val turn: Int, val phase: RunPhase) : AgentRunEvent() {
        override val kind = "agent_start"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); if (color != null) o.addProperty("color", color); o.addProperty("turn", turn); o.addProperty("phase", phase) }
    }
    data class AgentEnd(override val t: String, override val runId: String, val agent: String, val turn: Int, val status: String, val durationMs: Long) : AgentRunEvent() {
        override val kind = "agent_end"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); o.addProperty("turn", turn); o.addProperty("status", status); o.addProperty("durationMs", durationMs) }
    }
    data class AssistantDelta(override val t: String, override val runId: String, val agent: String, val text: String) : AgentRunEvent() {
        override val kind = "assistant_delta"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); o.addProperty("text", text) }
    }
    data class AssistantMessage(override val t: String, override val runId: String, val agent: String, val text: String) : AgentRunEvent() {
        override val kind = "assistant_message"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); o.addProperty("text", text) }
    }
    data class ToolUse(override val t: String, override val runId: String, val agent: String, val tool: String, val input: String? = null, val id: String? = null) : AgentRunEvent() {
        override val kind = "tool_use"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); o.addProperty("tool", tool); if (input != null) o.addProperty("input", input); if (id != null) o.addProperty("id", id) }
    }
    data class ToolResult(override val t: String, override val runId: String, val agent: String, val tool: String? = null, val ok: Boolean, val summary: String? = null, val id: String? = null) : AgentRunEvent() {
        override val kind = "tool_result"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); if (tool != null) o.addProperty("tool", tool); o.addProperty("ok", ok); if (summary != null) o.addProperty("summary", summary); if (id != null) o.addProperty("id", id) }
    }
    data class Usage(override val t: String, override val runId: String, val agent: String, val usage: RunUsage) : AgentRunEvent() {
        override val kind = "usage"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); val u = JsonObject(); u.addProperty("inputTokens", usage.inputTokens); u.addProperty("outputTokens", usage.outputTokens); u.addProperty("costUsd", usage.costUsd); o.add("usage", u) }
    }
    data class Message(override val t: String, override val runId: String, val from: String, val to: String, val text: String) : AgentRunEvent() {
        override val kind = "message"
        override fun fillJson(o: JsonObject) { o.addProperty("from", from); o.addProperty("to", to); o.addProperty("text", text) }
    }
    data class PlanArtifact(override val t: String, override val runId: String, val agent: String, val path: String, val bytes: Int) : AgentRunEvent() {
        override val kind = "plan_artifact"
        override fun fillJson(o: JsonObject) { o.addProperty("agent", agent); o.addProperty("path", path); o.addProperty("bytes", bytes) }
    }
    data class Error(override val t: String, override val runId: String, val agent: String? = null, val message: String) : AgentRunEvent() {
        override val kind = "error"
        override fun fillJson(o: JsonObject) { if (agent != null) o.addProperty("agent", agent); o.addProperty("message", message) }
    }
    data class Log(override val t: String, override val runId: String, val level: String, val message: String) : AgentRunEvent() {
        override val kind = "log"
        override fun fillJson(o: JsonObject) { o.addProperty("level", level); o.addProperty("message", message) }
    }
    data class RunEnd(override val t: String, override val runId: String, val status: RunStatus, val totals: RunUsage) : AgentRunEvent() {
        override val kind = "run_end"
        override fun fillJson(o: JsonObject) { o.addProperty("status", status); val u = JsonObject(); u.addProperty("inputTokens", totals.inputTokens); u.addProperty("outputTokens", totals.outputTokens); u.addProperty("costUsd", totals.costUsd); o.add("totals", u) }
    }
}
