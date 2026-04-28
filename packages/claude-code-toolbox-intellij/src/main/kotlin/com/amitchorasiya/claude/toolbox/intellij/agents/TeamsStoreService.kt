package com.amitchorasiya.claude.toolbox.intellij.agents

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.file.Files
import java.nio.file.Path

val TEAM_PROTOCOLS = listOf(
    "native-task", "round-robin", "handoff", "plan-then-code",
    "debate", "orchestrator", "parallel-fan-out", "converge",
)

data class TeamEntry(
    val id: String,
    val name: String,
    val description: String,
    val protocol: String,
    val runtime: String,
    val maxTurns: Int,
    val agents: List<String>,
    val codePhaseAgents: List<String>,
    val judge: String?,
    val orchestrator: String?,
    val scope: String,
    val filePath: String,
)

fun runtimeForProtocol(p: String): String =
    if (p == "native-task" || p == "round-robin" || p == "handoff") "native" else "custom"

private fun normalizeProtocol(raw: String?): String =
    if (raw != null && raw in TEAM_PROTOCOLS) raw else "native-task"

private fun normalizeStringArray(raw: Any?): List<String> {
    if (raw !is List<*>) return emptyList()
    return raw.filterIsInstance<String>().filter { it.isNotBlank() }
}

private fun readTeamFile(filePath: Path, scope: String): TeamEntry? {
    val text = try { Files.readString(filePath) } catch (_: Exception) { return null }
    val parsed = try {
        val el = JsonParser.parseString(text)
        if (!el.isJsonObject) return null
        el.asJsonObject
    } catch (_: Exception) { return null }
    val name = parsed.get("name")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotEmpty() }
        ?: filePath.fileName.toString().removeSuffix(".json")
    val description = parsed.get("description")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    val protocol = normalizeProtocol(parsed.get("protocol")?.takeIf { it.isJsonPrimitive }?.asString)
    val runtime = parsed.get("runtime")?.takeIf { it.isJsonPrimitive }?.asString?.let {
        if (it == "native" || it == "custom") it else runtimeForProtocol(protocol)
    } ?: runtimeForProtocol(protocol)
    val maxTurnsRaw = parsed.get("maxTurns")?.takeIf { it.isJsonPrimitive }?.asInt ?: 20
    val maxTurns = maxTurnsRaw.coerceIn(1, 100)
    val agents = jsonArrayToStringList(parsed.getAsJsonArray("agents") ?: parsed.getAsJsonArray("plan_phase_agents"))
    val codePhaseAgents = jsonArrayToStringList(parsed.getAsJsonArray("codePhaseAgents") ?: parsed.getAsJsonArray("code_phase_agents"))
    val judge = parsed.get("judge")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotEmpty() }
    val orchestrator = parsed.get("orchestrator")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotEmpty() }
    return TeamEntry(
        id = "$scope:${filePath.toAbsolutePath().toString().lowercase()}",
        name = name, description = description, protocol = protocol, runtime = runtime,
        maxTurns = maxTurns, agents = agents, codePhaseAgents = codePhaseAgents,
        judge = judge, orchestrator = orchestrator, scope = scope, filePath = filePath.toAbsolutePath().toString(),
    )
}

private fun jsonArrayToStringList(arr: JsonArray?): List<String> {
    if (arr == null) return emptyList()
    return (0 until arr.size()).mapNotNull { arr[it]?.takeIf { e -> e.isJsonPrimitive }?.asString?.takeIf { s -> s.isNotBlank() } }
}

private fun scanTeamsUnderRoot(root: Path, scope: String): List<TeamEntry> {
    val dir = root.toFile()
    if (!dir.isDirectory) return emptyList()
    return dir.listFiles()?.filter { it.isFile && it.extension.equals("json", ignoreCase = true) }
        ?.mapNotNull { readTeamFile(it.toPath(), scope) }
        ?.sortedBy { it.name } ?: emptyList()
}

fun teamsDirForScope(scope: String, homeDir: Path, workspaceRoot: Path?): Path? {
    return if (scope == "user") homeDir.resolve(".claude/teams")
    else workspaceRoot?.resolve(".claude/teams")
}

fun collectLocalTeams(homeDir: Path, workspaceRoot: Path?): List<TeamEntry> {
    val seen = mutableSetOf<String>()
    val merged = mutableListOf<TeamEntry>()
    if (workspaceRoot != null) {
        for (t in scanTeamsUnderRoot(workspaceRoot.resolve(".claude/teams"), "workspace")) {
            if (seen.add(t.id)) merged.add(t)
        }
    }
    for (t in scanTeamsUnderRoot(homeDir.resolve(".claude/teams"), "user")) {
        if (seen.add(t.id)) merged.add(t)
    }
    return merged
}

fun teamsToJsonArray(teams: List<TeamEntry>): JsonArray {
    val arr = JsonArray()
    for (t in teams) {
        val o = JsonObject()
        o.addProperty("id", t.id)
        o.addProperty("name", t.name)
        o.addProperty("description", t.description)
        o.addProperty("protocol", t.protocol)
        o.addProperty("runtime", t.runtime)
        o.addProperty("maxTurns", t.maxTurns)
        val agents = JsonArray(); t.agents.forEach { agents.add(it) }
        o.add("agents", agents)
        val cpa = JsonArray(); t.codePhaseAgents.forEach { cpa.add(it) }
        o.add("codePhaseAgents", cpa)
        if (t.judge != null) o.addProperty("judge", t.judge)
        if (t.orchestrator != null) o.addProperty("orchestrator", t.orchestrator)
        o.addProperty("scope", t.scope)
        o.addProperty("filePath", t.filePath)
        arr.add(o)
    }
    return arr
}

private fun serializeTeam(name: String, description: String, protocol: String, runtime: String, maxTurns: Int, agents: List<String>, codePhaseAgents: List<String>, judge: String?, orchestrator: String?): String {
    val o = JsonObject()
    o.addProperty("name", name.trim())
    o.addProperty("description", description.trim())
    o.addProperty("protocol", protocol)
    o.addProperty("runtime", runtime)
    o.addProperty("maxTurns", maxTurns)
    val ags = JsonArray(); agents.forEach { ags.add(it) }; o.add("agents", ags)
    val cpas = JsonArray(); codePhaseAgents.forEach { cpas.add(it) }; o.add("codePhaseAgents", cpas)
    if (judge != null) o.addProperty("judge", judge)
    if (orchestrator != null) o.addProperty("orchestrator", orchestrator)
    return com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(o) + "\n"
}

fun createTeam(
    name: String, description: String, protocol: String, runtime: String, maxTurns: Int,
    agents: List<String>, codePhaseAgents: List<String>, judge: String?, orchestrator: String?,
    scope: String, homeDir: Path, workspaceRoot: Path?,
): TeamEntry {
    val dir = teamsDirForScope(scope, homeDir, workspaceRoot) ?: error("Open a workspace folder to save workspace-scope teams.")
    dir.toFile().mkdirs()
    val base = name.trim().lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (base.isEmpty()) error("Team name must contain letters, digits, or dashes.")
    val target = dir.resolve("$base.json")
    if (target.toFile().exists()) error("Team \"$base.json\" already exists in $scope scope.")
    Files.writeString(target, serializeTeam(name, description, protocol, runtime, maxTurns, agents, codePhaseAgents, judge, orchestrator))
    return readTeamFile(target, scope) ?: error("Team saved but not readable back: $target")
}

fun updateTeam(
    existing: TeamEntry,
    name: String, description: String, protocol: String, runtime: String, maxTurns: Int,
    agents: List<String>, codePhaseAgents: List<String>, judge: String?, orchestrator: String?,
): TeamEntry {
    val currentBase = Path.of(existing.filePath).fileName.toString().removeSuffix(".json")
    val newBase = name.trim().lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (newBase.isEmpty()) error("Team name must contain letters, digits, or dashes.")
    val dir = Path.of(existing.filePath).parent
    val targetPath = dir.resolve("$newBase.json")
    if (currentBase != newBase && targetPath.toFile().exists()) {
        error("Team \"$newBase.json\" already exists in this scope.")
    }
    Files.writeString(targetPath, serializeTeam(name, description, protocol, runtime, maxTurns, agents, codePhaseAgents, judge, orchestrator))
    if (targetPath.toAbsolutePath().toString().lowercase() != Path.of(existing.filePath).toAbsolutePath().toString().lowercase()) {
        try { Files.deleteIfExists(Path.of(existing.filePath)) } catch (_: Exception) {}
    }
    return readTeamFile(targetPath, existing.scope) ?: error("Team updated but not readable back: $targetPath")
}

fun deleteTeam(filePath: String) {
    try { Files.deleteIfExists(Path.of(filePath)) } catch (_: Exception) {}
}
