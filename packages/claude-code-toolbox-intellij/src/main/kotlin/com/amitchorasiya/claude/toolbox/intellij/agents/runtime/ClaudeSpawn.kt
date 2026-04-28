package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import com.amitchorasiya.claude.toolbox.intellij.agents.AgentEntry
import com.google.gson.JsonParser
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

fun resolveClaudeBin(override: String?): String? {
    if (!override.isNullOrBlank()) {
        val f = File(override.trim())
        if (f.isFile) return f.absolutePath
    }
    val isWindows = System.getProperty("os.name").lowercase().contains("win")
    val pathEnv = System.getenv("PATH") ?: ""
    val sep = if (isWindows) ";" else ":"
    val exts = if (isWindows) listOf(".cmd", ".exe", ".bat") else listOf("")
    for (dir in pathEnv.split(sep)) {
        val base = dir.trim()
        if (base.isEmpty()) continue
        for (ext in exts) {
            val candidate = File(base, "claude$ext")
            if (candidate.isFile) return candidate.absolutePath
        }
    }
    return try {
        val finder = if (isWindows) "where" else "which"
        val proc = ProcessBuilder(finder, "claude").redirectErrorStream(true).start()
        val output = proc.inputStream.bufferedReader().readLine()?.trim()
        proc.waitFor(5, TimeUnit.SECONDS)
        if (!output.isNullOrBlank() && File(output).isFile) output else null
    } catch (_: Exception) { null }
}

fun parseStreamJsonLine(line: String, runId: String, agent: String, phase: RunPhase): List<AgentRunEvent> {
    val trimmed = line.trim()
    if (trimmed.isEmpty()) return emptyList()
    val msg = try {
        JsonParser.parseString(trimmed).asJsonObject
    } catch (_: Exception) {
        return listOf(AgentRunEvent.Log(nowIso(), runId, "warn", "unparsed line: ${summarizeForTranscript(trimmed)}"))
    }
    val t = nowIso()
    val type = msg.get("type")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    val subtype = msg.get("subtype")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    val out = mutableListOf<AgentRunEvent>()

    if (type == "assistant") {
        val content = msg.getAsJsonObject("message")?.getAsJsonArray("content") ?: return emptyList()
        for (i in 0 until content.size()) {
            val b = content[i]?.takeIf { it.isJsonObject }?.asJsonObject ?: continue
            val bType = b.get("type")?.asString
            if (bType == "text") {
                out.add(AgentRunEvent.AssistantDelta(t, runId, agent, b.get("text")?.asString ?: ""))
            } else if (bType == "tool_use") {
                val tool = b.get("name")?.asString ?: "Tool"
                val id = b.get("id")?.asString
                val input = b.get("input")?.toString()
                out.add(AgentRunEvent.ToolUse(t, runId, agent, tool, input, id))
                if (tool == "Task" && b.has("input") && b.get("input").isJsonObject) {
                    val sub = b.getAsJsonObject("input").get("subagent_type")?.asString ?: "agent"
                    out.add(AgentRunEvent.AgentStart(t, runId, sub, turn = 0, phase = phase))
                }
            }
        }
        return out
    }

    if (type == "user") {
        val content = msg.getAsJsonObject("message")?.getAsJsonArray("content") ?: return emptyList()
        for (i in 0 until content.size()) {
            val b = content[i]?.takeIf { it.isJsonObject }?.asJsonObject ?: continue
            if (b.get("type")?.asString != "tool_result") continue
            val id = b.get("tool_use_id")?.asString
            val ok = b.get("is_error")?.asBoolean != true
            val rawContent = b.get("content")
            val summary = when {
                rawContent?.isJsonPrimitive == true -> summarizeForTranscript(rawContent.asString)
                rawContent?.isJsonArray == true && rawContent.asJsonArray.size() > 0 -> {
                    val first = rawContent.asJsonArray[0]?.takeIf { it.isJsonObject }?.asJsonObject
                    summarizeForTranscript(first?.get("text")?.asString ?: "")
                }
                else -> ""
            }
            out.add(AgentRunEvent.ToolResult(t, runId, agent, ok = ok, summary = summary, id = id))
        }
        return out
    }

    if (type == "result") {
        val usage = msg.getAsJsonObject("usage")
        val totals = RunUsage(
            inputTokens = usage?.get("input_tokens")?.asLong ?: 0,
            outputTokens = usage?.get("output_tokens")?.asLong ?: 0,
            costUsd = msg.get("total_cost_usd")?.asDouble ?: 0.0,
        )
        out.add(AgentRunEvent.Usage(t, runId, agent, totals))
        val ok = subtype == "success" || msg.get("is_error")?.asBoolean != true
        if (ok) {
            out.add(AgentRunEvent.Log(t, runId, "info", "result: success"))
        } else {
            val err = msg.get("result")?.takeIf { it.isJsonPrimitive }?.asString ?: subtype.ifEmpty { "error" }
            out.add(AgentRunEvent.Error(t, runId, agent, err))
        }
        return out
    }

    if (type == "system" && subtype == "init") {
        out.add(AgentRunEvent.Log(t, runId, "info", "claude session initialised"))
    }

    return out
}

data class TurnResult(val text: String, val errored: Boolean, val aborted: Boolean)

fun spawnAgentTurn(
    agent: AgentEntry, prompt: String, runId: String, turn: Int, phase: RunPhase,
    bus: RunBus, totals: RunUsage, cwd: String?, claudeBin: String?,
    abortFlag: java.util.concurrent.atomic.AtomicBoolean,
): TurnResult {
    val binPath = resolveClaudeBin(claudeBin) ?: throw RuntimeException("claude CLI not found on PATH.")
    val systemPrompt = buildString {
        append(agent.systemPrompt.trim())
        append("\n\n## Your identity\n")
        append("You are the agent \"${agent.name}\" with role \"${agent.role.name.lowercase()}\" in a multi-agent team run.\n")
        append("Reply directly — do not delegate via the Task tool.")
    }
    val args = mutableListOf(binPath, "-p", prompt, "--output-format", "stream-json", "--verbose", "--append-system-prompt", systemPrompt)
    if (agent.model.isNotBlank()) args.addAll(listOf("--model", agent.model.trim()))

    val start = System.currentTimeMillis()
    bus.emit(AgentRunEvent.AgentStart(nowIso(), runId, agent.name, agent.color, turn, phase))

    var errored = false
    var aborted = false
    val deltas = mutableListOf<String>()

    try {
        val pb = ProcessBuilder(args).apply {
            if (cwd != null) directory(File(cwd))
            redirectErrorStream(false)
        }
        val process = pb.start()
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            if (abortFlag.get()) { process.destroyForcibly(); aborted = true; break }
            for (ev in parseStreamJsonLine(line!!, runId, agent.name, phase)) {
                bus.emit(ev)
                when (ev) {
                    is AgentRunEvent.AssistantDelta -> deltas.add(ev.text)
                    is AgentRunEvent.Usage -> totals.add(ev.usage)
                    is AgentRunEvent.Error -> errored = true
                    else -> {}
                }
            }
        }
        if (!aborted) process.waitFor(300, TimeUnit.SECONDS)
    } catch (e: Exception) {
        errored = true
        bus.emit(AgentRunEvent.Error(nowIso(), runId, agent.name, e.message ?: "unknown error"))
    }

    if (abortFlag.get()) aborted = true
    val status = if (aborted) "aborted" else if (errored) "error" else "ok"
    bus.emit(AgentRunEvent.AgentEnd(nowIso(), runId, agent.name, turn, status, System.currentTimeMillis() - start))
    return TurnResult(deltas.joinToString(""), errored, aborted)
}

fun spawnClaudeSession(
    prompt: String, runId: String, phase: RunPhase,
    bus: RunBus, totals: RunUsage, cwd: String?, claudeBin: String?,
    abortFlag: java.util.concurrent.atomic.AtomicBoolean,
    allowedAgents: List<String>? = null, appendSystemPrompt: String? = null,
): TurnResult {
    val binPath = resolveClaudeBin(claudeBin) ?: throw RuntimeException("claude CLI not found on PATH.")
    val args = mutableListOf(binPath, "-p", prompt, "--output-format", "stream-json", "--verbose")
    if (!allowedAgents.isNullOrEmpty()) args.addAll(listOf("--allowed-agents", allowedAgents.joinToString(",")))
    if (!appendSystemPrompt.isNullOrBlank()) args.addAll(listOf("--append-system-prompt", appendSystemPrompt))

    var errored = false
    var aborted = false
    val deltas = mutableListOf<String>()

    try {
        val pb = ProcessBuilder(args).apply {
            if (cwd != null) directory(File(cwd))
            redirectErrorStream(false)
        }
        val process = pb.start()
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            if (abortFlag.get()) { process.destroyForcibly(); aborted = true; break }
            for (ev in parseStreamJsonLine(line!!, runId, "orchestrator", phase)) {
                bus.emit(ev)
                when (ev) {
                    is AgentRunEvent.AssistantDelta -> deltas.add(ev.text)
                    is AgentRunEvent.Usage -> totals.add(ev.usage)
                    is AgentRunEvent.Error -> errored = true
                    else -> {}
                }
            }
        }
        if (!aborted) process.waitFor(300, TimeUnit.SECONDS)
    } catch (e: Exception) {
        errored = true
        bus.emit(AgentRunEvent.Error(nowIso(), runId, message = e.message ?: "unknown error"))
    }

    if (abortFlag.get()) aborted = true
    return TurnResult(deltas.joinToString(""), errored, aborted)
}
