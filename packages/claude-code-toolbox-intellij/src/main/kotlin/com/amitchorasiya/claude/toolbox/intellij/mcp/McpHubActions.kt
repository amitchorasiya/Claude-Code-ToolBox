package com.amitchorasiya.claude.toolbox.intellij.mcp

import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.google.gson.JsonObject
import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.nio.file.Path
import kotlin.io.path.Path

object McpHubActions {

    private fun stashFor(scope: String, projectRoot: Path?): McpStash {
        if (scope == "workspace") {
            if (projectRoot == null) error("workspace")
            return McpStash.Workspace(projectRoot)
        }
        return McpStash.User()
    }

    fun turnOffServer(project: Project, scope: String, serverId: String): String? {
        val base = project.basePath?.let { Path(it) }
        if (scope == "workspace" && base == null) {
            return "Open a project folder to change workspace MCP servers."
        }
        val settings = ToolboxSettings(base)
        val uri = when (scope) {
            "workspace" -> McpPaths.workspaceMcpJson(base!!)
            else -> settings.userMcpJsonPath()
        }
        val stash = stashFor(scope, base)
        val raw = McpJson.readOrEmpty(uri)
        val servers = McpJson.getServersObject(raw)
        val el = servers.remove(serverId) ?: return "Server \"$serverId\" is not in ${scope} mcp.json."
        if (!el.isJsonObject) return "Invalid server entry."
        stash.stashDisabled(serverId, el.asJsonObject)
        McpJson.writeDocument(uri, raw)
        return null
    }

    fun turnOnServer(project: Project, scope: String, serverId: String): String? {
        val base = project.basePath?.let { Path(it) }
        if (scope == "workspace" && base == null) {
            return "Open a project folder."
        }
        val settings = ToolboxSettings(base)
        val uri = when (scope) {
            "workspace" -> McpPaths.workspaceMcpJson(base!!)
            else -> settings.userMcpJsonPath()
        }
        val stash = stashFor(scope, base)
        val restored = stash.popDisabled(serverId) ?: return "No stashed config for \"$serverId\"."
        val raw = McpJson.readOrEmpty(uri)
        val servers = McpJson.getServersObject(raw)
        if (servers.has(serverId)) {
            stash.stashDisabled(serverId, restored)
            return "mcp.json already has \"$serverId\"."
        }
        servers.add(serverId, restored)
        McpJson.writeDocument(uri, raw)
        return null
    }

    fun deleteServer(project: Project, scope: String, serverId: String): String? {
        if (!ToolboxDialogUi.confirmOkCancel(
                project,
                "Claude Code ToolBox",
                "Remove MCP server \"$serverId\" ($scope) permanently from mcp.json / stash?",
                Messages.getWarningIcon(),
            )
        ) {
            return "cancelled"
        }
        val base = project.basePath?.let { Path(it) }
        if (scope == "workspace" && base == null) {
            return "Open a project folder."
        }
        val settings = ToolboxSettings(base)
        val uri = when (scope) {
            "workspace" -> McpPaths.workspaceMcpJson(base!!)
            else -> settings.userMcpJsonPath()
        }
        val stash = stashFor(scope, base)
        stash.removeStashEntry(serverId)
        val raw = McpJson.readOrEmpty(uri)
        val servers = McpJson.getServersObject(raw)
        servers.remove(serverId)
        McpJson.writeDocument(uri, raw)
        return null
    }
}
