package com.amitchorasiya.claude.toolbox.intellij.agents

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

enum class AgentRole { PLAN, CODE, REVIEW, BOTH }

data class AgentEntry(
    val id: String,
    val name: String,
    val description: String,
    val role: AgentRole,
    val model: String,
    val tools: List<String>,
    val color: String,
    val filePath: String,
    val systemPrompt: String,
    val scope: String,
    val disabled: Boolean = false,
)

private val DEFAULT_COLORS = listOf(
    "#4ec9b0", "#c586c0", "#9cdcfe", "#ce9178", "#b5cea8",
    "#dcdcaa", "#569cd6", "#f48771", "#d7ba7d",
)

fun colorForAgentName(name: String): String {
    var h = 0L
    for (ch in name) {
        h = ((h * 31) + ch.code) and 0xFFFFFFFFL
    }
    return DEFAULT_COLORS[(h % DEFAULT_COLORS.size).toInt()]
}

private val FM_REGEX = Regex("^---\\s*\\r?\\n([\\s\\S]*?)\\r?\\n---\\s*\\r?\\n?([\\s\\S]*)\$")

private fun splitFrontmatter(text: String): Pair<String, String> {
    val m = FM_REGEX.find(text) ?: return "" to text
    return m.groupValues[1] to m.groupValues[2]
}

private fun parseListValue(raw: String): List<String> {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return emptyList()
    val inner = if (trimmed.startsWith("[") && trimmed.endsWith("]")) trimmed.substring(1, trimmed.length - 1) else trimmed
    return inner.split(",").map { it.trim().removeSurrounding("\"").removeSurrounding("'") }.filter { it.isNotEmpty() }
}

fun parseAgentFrontmatter(fm: String): Map<String, Any> {
    if (fm.isBlank()) return emptyMap()
    val out = mutableMapOf<String, Any>()
    for (line in fm.lines()) {
        val t = line.trim()
        if (t.isEmpty() || t.startsWith("#")) continue
        val m = Regex("^\\s*([A-Za-z0-9_-]+)\\s*:\\s*(.*)\$").find(line) ?: continue
        val key = m.groupValues[1].lowercase()
        val raw = m.groupValues[2]
        if (key == "tools") {
            out[key] = parseListValue(raw)
            continue
        }
        out[key] = raw.trim().removeSurrounding("\"").removeSurrounding("'")
    }
    return out
}

private fun normalizeRole(raw: Any?): AgentRole {
    val v = (raw as? String)?.lowercase() ?: ""
    return when (v) {
        "plan" -> AgentRole.PLAN; "code" -> AgentRole.CODE; "review" -> AgentRole.REVIEW; "both" -> AgentRole.BOTH
        else -> AgentRole.BOTH
    }
}

private fun readAgentFile(filePath: Path, scope: String): AgentEntry? {
    val text = try { Files.readString(filePath) } catch (_: Exception) { return null }
    val (fm, body) = splitFrontmatter(text)
    val parsed = parseAgentFrontmatter(fm)
    val name = (parsed["name"] as? String)?.takeIf { it.isNotEmpty() } ?: filePath.fileName.toString().removeSuffix(".md")
    val description = (parsed["description"] as? String)?.take(280) ?: ""
    val role = normalizeRole(parsed["role"])
    val model = (parsed["model"] as? String) ?: ""
    @Suppress("UNCHECKED_CAST")
    val tools = (parsed["tools"] as? List<String>) ?: emptyList()
    val declaredColor = (parsed["color"] as? String)?.trim() ?: ""
    val color = if (Regex("^#[0-9a-fA-F]{3,8}\$").matches(declaredColor)) declaredColor else colorForAgentName(name)
    return AgentEntry(
        id = "$scope:${filePath.toAbsolutePath().toString().lowercase()}",
        name = name, description = description, role = role, model = model, tools = tools,
        color = color, filePath = filePath.toAbsolutePath().toString(), systemPrompt = body.trim(), scope = scope,
    )
}

private fun scanAgentsUnderRoot(root: Path, scope: String): List<AgentEntry> {
    val dir = root.toFile()
    if (!dir.isDirectory) return emptyList()
    return dir.listFiles()?.filter { it.isFile && it.extension.equals("md", ignoreCase = true) }
        ?.mapNotNull { readAgentFile(it.toPath(), scope) }
        ?.sortedBy { it.name } ?: emptyList()
}

fun collectLocalAgents(homeDir: Path, workspaceRoot: Path?): List<AgentEntry> {
    val seen = mutableSetOf<String>()
    val merged = mutableListOf<AgentEntry>()
    if (workspaceRoot != null) {
        for (a in scanAgentsUnderRoot(workspaceRoot.resolve(".claude/agents"), "workspace")) {
            if (seen.add(a.id)) merged.add(a)
        }
    }
    for (a in scanAgentsUnderRoot(homeDir.resolve(".claude/agents"), "user")) {
        if (seen.add(a.id)) merged.add(a)
    }
    return merged
}

fun agentsDirForScope(scope: String, homeDir: Path, workspaceRoot: Path?): Path? {
    return if (scope == "user") homeDir.resolve(".claude/agents")
    else workspaceRoot?.resolve(".claude/agents")
}

fun agentsToJsonArray(agents: List<AgentEntry>): JsonArray {
    val arr = JsonArray()
    for (a in agents) {
        val o = JsonObject()
        o.addProperty("id", a.id)
        o.addProperty("name", a.name)
        o.addProperty("description", a.description)
        o.addProperty("role", a.role.name.lowercase())
        o.addProperty("model", a.model)
        val tools = JsonArray(); a.tools.forEach { tools.add(it) }
        o.add("tools", tools)
        o.addProperty("color", a.color)
        o.addProperty("filePath", a.filePath)
        o.addProperty("scope", a.scope)
        o.addProperty("disabled", a.disabled)
        arr.add(o)
    }
    return arr
}

fun createAgentFile(name: String, description: String, role: String, model: String, tools: List<String>, scope: String, homeDir: Path, workspaceRoot: Path?): AgentEntry {
    val dir = agentsDirForScope(scope, homeDir, workspaceRoot) ?: error("Open a workspace folder to save workspace-scope agents.")
    dir.toFile().mkdirs()
    val base = name.trim().lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (base.isEmpty()) error("Agent name must contain letters, digits, or dashes.")
    val target = dir.resolve("$base.md")
    if (target.toFile().exists()) error("Agent \"$base.md\" already exists in $scope scope.")
    val lines = mutableListOf("---")
    lines.add("name: $name")
    if (description.isNotBlank()) lines.add("description: $description")
    lines.add("role: $role")
    if (model.isNotBlank()) lines.add("model: $model")
    if (tools.isNotEmpty()) lines.add("tools: [${tools.joinToString(", ") { "\"$it\"" }}]")
    lines.add("---")
    lines.add("")
    Files.writeString(target, lines.joinToString("\n"))
    return readAgentFile(target, scope) ?: error("Agent created but not readable back: $target")
}

fun deleteAgentFile(filePath: String) {
    val f = File(filePath)
    if (f.exists()) f.delete()
}
