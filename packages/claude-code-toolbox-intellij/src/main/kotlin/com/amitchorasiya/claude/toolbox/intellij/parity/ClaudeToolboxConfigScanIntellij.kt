package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.util.regex.Pattern

/** Mirrors [packages/cloude-code-toolbox/src/commands/claudeToolboxConfigScan.ts]. */
object ClaudeToolboxConfigScanIntellij {

    private val SECRET_PATTERNS: List<Pair<String, Pattern>> = listOf(
        "GitHub PAT-like (ghp_)" to Pattern.compile("ghp_[A-Za-z0-9]{20,}"),
        "OpenAI sk- key-like" to Pattern.compile("sk-[A-Za-z0-9]{20,}"),
        "AWS AKIA key id-like" to Pattern.compile("AKIA[0-9A-Z]{16}"),
    )

    fun run(project: Project, settings: ToolboxSettings) {
        val base = project.basePath ?: run {
            Messages.showErrorDialog(project, "Open a workspace folder first.", "Claude Code ToolBox")
            return
        }
        val root = Path.of(base)
        val lines = mutableListOf<String>()
        lines.add("# Claude Code ToolBox — MCP / instruction config scan")
        lines.add("")
        lines.add("_Heuristic scan only. Review findings manually. Not a substitute for secret scanning in CI._")
        lines.add("")
        val wsMcp = McpPaths.workspaceMcpJson(root)
        scanFileSection(lines, "Workspace mcp.json", wsMcp)
        val userMcp = McpPaths.userMcpJson()
        scanFileSection(lines, "User mcp.json", userMcp)
        val copilot = root.resolve(".github").resolve("copilot-instructions.md")
        scanFileSection(lines, "copilot-instructions.md", copilot)
        val text = lines.joinToString("\n")
        ParityScratchFiles.openUnderClaude(project, "cloude-code-toolbox-config-scan.md", text)
        Messages.showInfoMessage(
            project,
            "Claude Code / MCP config scan complete — review the opened editor tab.",
            "Claude Code ToolBox",
        )
    }

    private fun scanFileSection(lines: MutableList<String>, label: String, path: Path) {
        lines.add("## $label")
        lines.add("- Path: `$path`")
        if (!Files.isRegularFile(path)) {
            lines.add("- _File not found or not readable._")
            lines.add("")
            return
        }
        val text = try {
            Files.readString(path, StandardCharsets.UTF_8)
        } catch (_: Exception) {
            lines.add("- _File not found or not readable._")
            lines.add("")
            return
        }
        val bytes = text.toByteArray(StandardCharsets.UTF_8)
        lines.add("- Bytes: ${bytes.size}")
        var foundAny = false
        for ((name, re) in SECRET_PATTERNS) {
            val m = re.matcher(text)
            val hits = mutableListOf<String>()
            while (m.find()) {
                val s = m.group()
                hits.add(if (s.length > 12) "${s.take(6)}…${s.takeLast(4)}" else "[redacted]")
            }
            if (hits.isNotEmpty()) {
                foundAny = true
                lines.add("- **Possible $name** (${hits.size} match(es)): ${hits.distinct().joinToString(", ")}")
            }
        }
        if (!foundAny) {
            lines.add("- No common secret-shaped tokens matched (still verify env and commits).")
        }
        lines.add("")
    }
}
