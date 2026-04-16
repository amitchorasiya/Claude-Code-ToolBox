package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.amitchorasiya.claude.toolbox.intellij.hub.ClaudeHubBridge
import com.amitchorasiya.claude.toolbox.intellij.hub.HubStateService
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories

private const val AWARENESS_FILE = "cloude-code-toolbox-mcp-skills-awareness.md"
private const val AWARENESS_REL = ".claude/$AWARENESS_FILE"

private const val BANNER_START = "<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->"
private const val BANNER_END = "<!-- cloude-code-toolbox:mcp-skills-awareness-end -->"

/** Mirrors [packages/cloude-code-toolbox/src/intelligence/formatMcpSkillsAwareness.ts] + file write. */
object McpSkillsAwarenessIntellij {

    /**
     * @param openAwarenessInEditor When false (e.g. Thinking Machine silent priming), still writes files and merges per [mergeIntoClaudeMd] but does not open the report tab.
     */
    fun runScan(project: Project, mergeIntoClaudeMd: Boolean, openAwarenessInEditor: Boolean = true) {
        val base = project.basePath ?: return
        val root = Path.of(base)
        val payload = HubStateService.gatherPayload(project)
        val paths = awarenessPathsFrom(project, payload)
        val fullMd = formatFullReport(payload, paths)
        val claudeDir = root.resolve(".claude")
        claudeDir.createDirectories()
        Files.writeString(claudeDir.resolve(AWARENESS_FILE), fullMd, StandardCharsets.UTF_8)
        if (mergeIntoClaudeMd) {
            val block = formatClaudeBlock(payload, paths)
            val wrapped = buildWrappedBlock(block)
            val claude = root.resolve("CLAUDE.md")
            val existing = if (Files.exists(claude)) Files.readString(claude, StandardCharsets.UTF_8) else ""
            val next = replaceOrAppendBlock(existing, wrapped)
            Files.writeString(claude, next, StandardCharsets.UTF_8)
        }
        if (openAwarenessInEditor) {
            openInEditor(project, claudeDir.resolve(AWARENESS_FILE))
        }
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun awarenessPathsFrom(project: Project, payload: JsonObject): AwarenessPaths {
        val base = project.basePath ?: return AwarenessPaths("", null, null)
        val settings = ToolboxSettings(Path.of(base))
        val userMcp = McpPaths.userMcpJson(settings.getUseInsidersPaths()).toAbsolutePath().normalize().toString()
        val ws = Path.of(base).resolve(".vscode").resolve("mcp.json").toAbsolutePath().normalize().toString()
        val wsName = payload.get("workspaceName")?.asString
        return AwarenessPaths(userMcp, ws, wsName)
    }

    private fun formatFullReport(payload: JsonObject, paths: AwarenessPaths): String {
        val ts = java.time.Instant.now().toString()
        val lines = mutableListOf<String>()
        lines.add("# Claude Code ToolBox — MCP & Skills awareness")
        lines.add("")
        lines.add("_Generated: ${ts}_")
        lines.add("")
        lines.add("## How to use this report")
        lines.add("")
        lines.add("- **Saved copy:** `$AWARENESS_REL` — refreshed when you run **Scan MCP & Skills awareness** in IntelliJ.")
        lines.add("")
        lines.add("---")
        lines.add("")
        lines.add("## MCP — workspace")
        lines.add("")
        if (paths.workspaceMcpPath != null) {
            val wsLabel = paths.workspaceName?.let { " _(folder: $it)_" } ?: ""
            lines.add("Workspace `${paths.workspaceMcpPath}`$wsLabel")
            lines.add("")
            lines.add(mcpFileLine(payload.get("workspaceMcp")?.asString ?: "missing", paths.workspaceMcpPath!!))
            lines.add("")
            appendServerTables(lines, payload.getAsJsonArray("workspaceServers"))
        } else {
            lines.add("_No workspace folder open — workspace `mcp.json` not scanned._")
            lines.add("")
        }
        lines.add("## MCP — user profile")
        lines.add("")
        lines.add(mcpFileLine(payload.get("userMcp")?.asString ?: "missing", paths.userMcpPath))
        lines.add("")
        appendServerTables(lines, payload.getAsJsonArray("userServers"))
        lines.add("## Skills (local `SKILL.md` folders)")
        lines.add("")
        appendSkills(lines, payload.getAsJsonArray("skills"))
        lines.add("---")
        lines.add("")
        lines.add("_Report from Claude Code ToolBox (IntelliJ)._")
        lines.add("")
        return lines.joinToString("\n")
    }

    private fun mcpFileLine(status: String, path: String): String {
        val label = when (status) {
            "missing" -> "File missing"
            "empty" -> "File exists — no servers defined"
            else -> "File exists — servers defined"
        }
        return "- **$path** — _${label}_"
    }

    private fun appendServerTables(lines: MutableList<String>, rows: JsonArray?) {
        if (rows == null || rows.size() == 0) {
            lines.add("_No servers._")
            lines.add("")
            return
        }
        val active = mutableListOf<JsonObject>()
        val off = mutableListOf<JsonObject>()
        for (el in rows) {
            if (!el.isJsonObject) continue
            val o = el.asJsonObject
            if (o.get("disabled")?.asBoolean == true) off.add(o) else active.add(o)
        }
        if (active.isEmpty()) {
            lines.add("_No active servers._")
            lines.add("")
        } else {
            lines.add("| Server id | Kind | Detail |")
            lines.add("|-----------|------|--------|")
            for (o in active) {
                val det = esc(o.get("detail")?.asString ?: "")
                lines.add("| ${o.get("id")?.asString} | ${o.get("kind")?.asString} | $det |")
            }
            lines.add("")
        }
        if (off.isNotEmpty()) {
            lines.add("_Servers **off** (stash):_")
            lines.add("")
            lines.add("| Server id | Kind | Detail |")
            lines.add("|-----------|------|--------|")
            for (o in off) {
                val det = esc(o.get("detail")?.asString ?: "")
                lines.add("| ${o.get("id")?.asString} | ${o.get("kind")?.asString} | $det |")
            }
            lines.add("")
        }
    }

    private fun appendSkills(lines: MutableList<String>, skills: JsonArray?) {
        if (skills == null || skills.size() == 0) {
            lines.add("_None found._")
            lines.add("")
            return
        }
        val ws = mutableListOf<JsonObject>()
        val user = mutableListOf<JsonObject>()
        for (el in skills) {
            if (!el.isJsonObject) continue
            val o = el.asJsonObject
            when (o.get("scope")?.asString) {
                "workspace" -> ws.add(o)
                "user" -> user.add(o)
            }
        }
        lines.add("### Project-scoped")
        lines.add("")
        appendSkillList(lines, ws)
        lines.add("### User-scoped")
        lines.add("")
        appendSkillList(lines, user)
    }

    private fun appendSkillList(lines: MutableList<String>, list: List<JsonObject>) {
        if (list.isEmpty()) {
            lines.add("_None._")
            lines.add("")
            return
        }
        for (o in list) {
            val name = o.get("name")?.asString ?: "?"
            val rootPath = o.get("rootPath")?.asString ?: ""
            val desc = o.get("description")?.asString ?: ""
            val off = o.get("disabled")?.asBoolean == true
            if (!off) {
                lines.add("- **$name** — `$rootPath`")
                lines.add("  - $desc")
                lines.add("")
            }
        }
    }

    private fun formatClaudeBlock(payload: JsonObject, paths: AwarenessPaths): String {
        val ts = java.time.Instant.now().toString()
        val lines = mutableListOf<String>()
        lines.add("### MCP & Skills awareness (Claude Code ToolBox)")
        lines.add("")
        lines.add("_Last synced: ${ts}._")
        lines.add("")
        lines.add("- **Full report:** `$AWARENESS_REL`")
        lines.add("")
        lines.add("#### Workspace MCP")
        lines.add("")
        if (paths.workspaceMcpPath != null) {
            lines.add("- `${paths.workspaceMcpPath}` — _${statusShort(payload.get("workspaceMcp")?.asString)}_")
            lines.add("")
            compactServers(lines, payload.getAsJsonArray("workspaceServers"))
        } else {
            lines.add("_No workspace._")
            lines.add("")
        }
        lines.add("#### User MCP")
        lines.add("")
        lines.add("- `${paths.userMcpPath}` — _${statusShort(payload.get("userMcp")?.asString)}_")
        lines.add("")
        compactServers(lines, payload.getAsJsonArray("userServers"))
        return lines.joinToString("\n")
    }

    private fun statusShort(s: String?): String = when (s) {
        "missing" -> "file missing"
        "empty" -> "no servers defined"
        else -> "servers defined"
    }

    private fun compactServers(lines: MutableList<String>, rows: JsonArray?) {
        if (rows == null) return
        for (el in rows) {
            if (!el.isJsonObject) continue
            val o = el.asJsonObject
            if (o.get("disabled")?.asBoolean == true) continue
            lines.add("- **${o.get("id")?.asString}** (${o.get("kind")?.asString})")
        }
        lines.add("")
    }

    private fun buildWrappedBlock(inner: String): String {
        return listOf(
            "",
            BANNER_START,
            "",
            inner.trim(),
            "",
            BANNER_END,
            "",
        ).joinToString("\n")
    }

    private fun replaceOrAppendBlock(existing: String, block: String): String {
        val t = existing.trim()
        if (t.isEmpty()) {
            return "# Claude Code — project context\n$block"
        }
        if (t.contains(BANNER_START) && t.contains(BANNER_END)) {
            val re = Regex(
                Regex.escape(BANNER_START) + "[\\s\\S]*?" + Regex.escape(BANNER_END) + "\\n*",
                RegexOption.MULTILINE,
            )
            return t.replace(re, block)
        }
        return t + block
    }

    private fun esc(s: String): String = s.replace("|", "\\|").replace("\n", " ")

    private fun openInEditor(project: Project, path: Path) {
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(path.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }

    private data class AwarenessPaths(
        val userMcpPath: String,
        val workspaceMcpPath: String?,
        val workspaceName: String?,
    )
}
