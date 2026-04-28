package com.amitchorasiya.claude.toolbox.intellij.agents

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.nio.file.Files
import java.nio.file.Path

const val COMMANDS_PACK_MARKER = "<!-- claude-code-toolbox v1 -->"

data class InstalledCommand(
    val id: String,
    val filePath: String,
    val scope: String,
    val description: String?,
    val argumentHint: String?,
    val ownedByToolbox: Boolean,
)

data class CommandDraft(
    val name: String,
    val description: String,
    val argumentHint: String,
    val agents: List<String>,
    val instructions: String,
    val scope: String,
)

fun commandsDirForScope(scope: String, homeDir: Path, workspaceRoot: Path?): Path? {
    return if (scope == "user") homeDir.resolve(".claude/commands")
    else workspaceRoot?.resolve(".claude/commands")
}

fun listInstalledCommands(homeDir: Path, workspaceRoot: Path?): List<InstalledCommand> {
    val out = mutableListOf<InstalledCommand>()
    for (scope in listOf("user", "workspace")) {
        val dir = commandsDirForScope(scope, homeDir, workspaceRoot) ?: continue
        val files = dir.toFile().listFiles()?.filter { it.isFile && it.extension.equals("md", ignoreCase = true) } ?: continue
        for (f in files) {
            val text = try { Files.readString(f.toPath()) } catch (_: Exception) { continue }
            val fmMatch = Regex("^---\\s*\\r?\\n([\\s\\S]*?)\\r?\\n---").find(text)
            val fm = fmMatch?.groupValues?.getOrNull(1) ?: ""
            val descMatch = Regex("^\\s*description:\\s*(.+?)\\s*$", RegexOption.MULTILINE).find(fm)
            val hintMatch = Regex("^\\s*argument-hint:\\s*(.+?)\\s*$", RegexOption.MULTILINE).find(fm)
            out.add(InstalledCommand(
                id = f.nameWithoutExtension,
                filePath = f.absolutePath,
                scope = scope,
                description = descMatch?.groupValues?.get(1)?.removeSurrounding("\"")?.removeSurrounding("'"),
                argumentHint = hintMatch?.groupValues?.get(1)?.removeSurrounding("\"")?.removeSurrounding("'"),
                ownedByToolbox = text.contains(COMMANDS_PACK_MARKER),
            ))
        }
    }
    return out
}

private fun escapeYamlScalar(s: String): String {
    if (s.isEmpty()) return "\"\""
    val needsQuote = Regex("[:\\-?#*&!|>'\"% @`,\\[\\]{}\\n]").containsMatchIn(s) || s.startsWith(" ") || s.endsWith(" ")
    return if (needsQuote) "\"${s.replace("\\", "\\\\").replace("\"", "\\\"")}\"" else s
}

private fun buildCommandBody(agents: List<String>, instructions: String): String {
    if (instructions.isNotBlank()) return instructions.trim()
    if (agents.isEmpty()) return "User's request:\n\$ARGUMENTS"
    val lines = mutableListOf(
        "You have access to these custom subagents. Use the **Task** tool to dispatch work to them, one at a time, in this order:",
        "",
    )
    agents.forEachIndexed { i, a -> lines.add("${i + 1}. `$a`") }
    lines.add("")
    lines.add("After all agents have replied, synthesize their outputs into a coherent response.")
    lines.add("")
    lines.add("User's request:")
    lines.add("\$ARGUMENTS")
    return lines.joinToString("\n")
}

fun buildTeamCommandBody(teamName: String, agents: List<String>): String {
    val lines = mutableListOf(
        "Run this command using the **Task** tool to dispatch each subagent in order:",
        "",
    )
    agents.forEachIndexed { i, a -> lines.add("${i + 1}. `$a`") }
    lines.add("")
    lines.add("After all agents have replied, synthesize their outputs into a coherent response.")
    lines.add("")
    lines.add("User's request:")
    lines.add("\$ARGUMENTS")
    return lines.joinToString("\n")
}

fun renderCommandMarkdown(draft: CommandDraft): String {
    val body = buildCommandBody(draft.agents, draft.instructions)
    return listOf(
        "---",
        "description: ${escapeYamlScalar(draft.description.trim())}",
        "argument-hint: ${escapeYamlScalar(draft.argumentHint.trim())}",
        "---",
        COMMANDS_PACK_MARKER,
        "",
        body,
        "",
    ).joinToString("\n")
}

fun createCommand(draft: CommandDraft, homeDir: Path, workspaceRoot: Path?): InstalledCommand {
    val dir = commandsDirForScope(draft.scope, homeDir, workspaceRoot) ?: error("Open a workspace folder to save workspace-scope commands.")
    dir.toFile().mkdirs()
    val base = draft.name.trim().lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (base.isEmpty()) error("Command name must contain letters, digits, or dashes.")
    val target = dir.resolve("$base.md")
    if (target.toFile().exists()) error("Command \"$base.md\" already exists in ${draft.scope} scope.")
    Files.writeString(target, renderCommandMarkdown(draft))
    return listInstalledCommands(homeDir, workspaceRoot).find {
        Path.of(it.filePath).toAbsolutePath().toString().lowercase() == target.toAbsolutePath().toString().lowercase()
    } ?: error("Command created but not found back on disk: $target")
}

fun updateCommand(existing: InstalledCommand, draft: CommandDraft, homeDir: Path, workspaceRoot: Path?): InstalledCommand {
    val currentBase = Path.of(existing.filePath).fileName.toString().removeSuffix(".md")
    val newBase = draft.name.trim().lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (newBase.isEmpty()) error("Command name must contain letters, digits, or dashes.")
    val dir = Path.of(existing.filePath).parent
    val targetPath = dir.resolve("$newBase.md")
    if (currentBase != newBase && targetPath.toFile().exists()) error("Command \"$newBase.md\" already exists in this scope.")
    Files.writeString(targetPath, renderCommandMarkdown(draft))
    if (targetPath.toAbsolutePath().toString().lowercase() != Path.of(existing.filePath).toAbsolutePath().toString().lowercase()) {
        try { Files.deleteIfExists(Path.of(existing.filePath)) } catch (_: Exception) {}
    }
    return listInstalledCommands(homeDir, workspaceRoot).find {
        Path.of(it.filePath).toAbsolutePath().toString().lowercase() == targetPath.toAbsolutePath().toString().lowercase()
    } ?: error("Command updated but not found back on disk: $targetPath")
}

fun deleteCommand(filePath: String) {
    try { Files.deleteIfExists(Path.of(filePath)) } catch (_: Exception) {}
}

fun parseAgentsFromBody(body: String): List<String> {
    val agents = mutableListOf<String>()
    val re = Regex("^\\s*\\d+\\.\\s*`([^`]+)`", RegexOption.MULTILINE)
    for (m in re.findAll(body)) {
        val name = m.groupValues[1].trim()
        if (name.isNotEmpty() && name !in agents) agents.add(name)
    }
    return agents
}

fun readCommandBody(filePath: String): String {
    val text = try { Files.readString(Path.of(filePath)) } catch (_: Exception) { return "" }
    val afterFm = text.replace(Regex("^---\\s*\\r?\\n[\\s\\S]*?\\r?\\n---\\s*\\r?\\n?"), "")
    val afterMarker = afterFm.replace(Regex("^\\s*${Regex.escape(COMMANDS_PACK_MARKER)}\\s*\\r?\\n?"), "")
    return afterMarker.trim()
}

fun commandsToJsonArray(commands: List<InstalledCommand>): JsonArray {
    val arr = JsonArray()
    for (c in commands) {
        val o = JsonObject()
        o.addProperty("id", c.id)
        o.addProperty("filePath", c.filePath)
        o.addProperty("scope", c.scope)
        if (c.description != null) o.addProperty("description", c.description)
        if (c.argumentHint != null) o.addProperty("argumentHint", c.argumentHint)
        o.addProperty("ownedByToolbox", c.ownedByToolbox)
        arr.add(o)
    }
    return arr
}
