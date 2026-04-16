package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.hub.HubStateService
import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpJson
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.amitchorasiya.claude.toolbox.intellij.hub.ClaudeHubBridge
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.nio.charset.StandardCharsets

/** Basic MCP server list + manual JSON add (VS Code native MCP UI parity). */
object McpServersUiIntellij {

    fun listServers(project: Project) {
        val payload = HubStateService.gatherPayload(project)
        val lines = mutableListOf<String>()
        lines.add("# MCP servers")
        lines.add("")
        lines.add("| Scope | Id | Kind | Detail | Off |")
        lines.add("|-------|----|-----|--------|-----|")
        appendRows(lines, "workspace", payload.getAsJsonArray("workspaceServers"))
        appendRows(lines, "user", payload.getAsJsonArray("userServers"))
        lines.add("")
        lines.add("_Open `.vscode/mcp.json` or user `mcp.json` from the hub to edit JSON._")
        ParityScratchFiles.openUnderClaude(project, "mcp-servers-overview.md", lines.joinToString("\n"))
    }

    fun addServer(project: Project, settings: ToolboxSettings) {
        val base = project.basePath ?: run {
            Messages.showErrorDialog(project, "Open a workspace folder first.", "Claude Code ToolBox")
            return
        }
        val scopes = arrayOf("Workspace (.vscode/mcp.json)", "User profile mcp.json")
        val sidx = ToolboxDialogUi.showChooseDialog(
            project,
            "Where should the new server be stored?",
            "Add MCP server",
            Messages.getQuestionIcon(),
            scopes,
            scopes[0],
        )
        if (sidx < 0) return
        val workspaceScope = sidx == 0
        val serverId = Messages.showInputDialog(
            project,
            "Server id (JSON key under \"servers\"):",
            "Add MCP server",
            Messages.getQuestionIcon(),
        )?.trim().orEmpty()
        if (serverId.isEmpty()) return
        val jsonStr = Messages.showMultilineInputDialog(
            project,
            "Paste the server config as a JSON object, e.g. {\"type\":\"stdio\",\"command\":\"npx\", ...}",
            "Server config JSON",
            "",
            Messages.getQuestionIcon(),
            null,
        )?.trim().orEmpty()
        if (jsonStr.isEmpty()) return
        val cfg = try {
            JsonParser.parseString(jsonStr)
        } catch (e: Exception) {
            Messages.showErrorDialog(project, "Invalid JSON: ${e.message}", "Claude Code ToolBox")
            return
        }
        if (!cfg.isJsonObject) {
            Messages.showErrorDialog(project, "Server config must be a JSON object.", "Claude Code ToolBox")
            return
        }
        val rootPath = java.nio.file.Path.of(base)
        val mcpPath = if (workspaceScope) McpPaths.workspaceMcpJson(rootPath) else settings.userMcpJsonPath()
        val doc = McpJson.readOrEmpty(mcpPath)
        val servers = McpJson.getServersObject(doc)
        if (servers.has(serverId)) {
            val ok = Messages.showYesNoDialog(
                project,
                "Server \"$serverId\" already exists. Overwrite?",
                "Overwrite",
                Messages.getWarningIcon(),
            )
            if (ok != Messages.YES) return
        }
        servers.add(serverId, cfg)
        McpJson.writeDocument(mcpPath, doc)
        Messages.showInfoMessage(project, "Updated ${mcpPath.fileName} (server \"$serverId\").", "Claude Code ToolBox")
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun appendRows(lines: MutableList<String>, scope: String, arr: JsonArray?) {
        if (arr == null || arr.size() == 0) {
            lines.add("| $scope | _none_ | | | |")
            return
        }
        for (el in arr) {
            if (!el.isJsonObject) continue
            val o = el.asJsonObject
            val id = esc(o.get("id")?.asString ?: "?")
            val kind = esc(o.get("kind")?.asString ?: "")
            val det = esc(o.get("detail")?.asString ?: "")
            val off = if (o.get("disabled")?.asBoolean == true) "yes" else ""
            lines.add("| $scope | $id | $kind | $det | $off |")
        }
    }

    private fun esc(s: String): String = s.replace("|", "\\|").replace("\n", " ").take(120)
}
