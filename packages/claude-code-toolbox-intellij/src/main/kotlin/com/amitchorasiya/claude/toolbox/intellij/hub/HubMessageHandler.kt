package com.amitchorasiya.claude.toolbox.intellij.hub

import com.amitchorasiya.claude.toolbox.intellij.http.RegistryHttp
import com.amitchorasiya.claude.toolbox.intellij.http.SkillsShHttp
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpHubActions
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpRegistryInstall
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillFolderDelete
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillHubState
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillsCli
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.ide.actions.RevealFileAction
import com.intellij.ide.projectView.ProjectView
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File
import kotlin.io.path.Path

private val LOG = logger<HubMessageHandler>()

/**
 * Handles JSON lines from the hub script (same message shapes as VS Code webview).
 * See [packages/cloude-code-toolbox/src/webview/mcpSkillsHubView.ts].
 */
object HubMessageHandler {

    fun handle(project: Project, requestJson: String, postToWebView: (JsonObject) -> Unit) {
        val root: JsonObject = try {
            JsonParser.parseString(requestJson).asJsonObject
        } catch (e: Exception) {
            LOG.warn("hub message parse failed: $requestJson", e)
            return
        }
        val type = root.get("type")?.asString ?: return

        when (type) {
            "ready", "refresh" -> HubStateService.postFullState(project, postToWebView)
            "runCommand" -> {
                val cmd = root.get("command")?.asString
                if (!cmd.isNullOrBlank()) {
                    if (!HubCommandBridge.tryExecute(project, cmd)) {
                        notify(
                            project,
                            "No IntelliJ action for \"$cmd\". If this is a hub command id, add it to VsCodeHubCommandIds; otherwise register an action or use VS Code.",
                            NotificationType.INFORMATION,
                        )
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "runCommandWithArgs" -> {
                val cmd = root.get("command")?.asString
                if (!cmd.isNullOrBlank()) {
                    if (cmd == "CloudeCodeToolBox.openKitTarget") {
                        val args = root.get("args")
                        if (args != null && args.isJsonArray) {
                            val arr = args.asJsonArray
                            if (arr.size() >= 1) {
                                val p = arr[0].asString
                                val isDir = arr.size() > 1 && arr[1].asBoolean
                                KitTargetOpener.open(project, p, isDir)
                            }
                        }
                    } else if (!HubCommandBridge.tryExecute(project, cmd)) {
                        notify(
                            project,
                            "No action for command with args: $cmd",
                            NotificationType.INFORMATION,
                        )
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "registrySearch" -> {
                val gen = root.get("generation")?.asInt ?: 0
                val search = root.get("search")?.asString ?: ""
                val cursor = root.get("cursor")?.asString
                val append = root.get("append")?.asBoolean == true
                ApplicationManager.getApplication().executeOnPooledThread {
                    val r = RegistryHttp.search(search, 12, cursor)
                    ApplicationManager.getApplication().invokeLater {
                        postRegistryResult(postToWebView, gen, append, r.servers, r.nextCursor, r.error)
                    }
                }
            }
            "skillSearch" -> {
                val gen = root.get("generation")?.asInt ?: 0
                val query = root.get("query")?.asString ?: ""
                ApplicationManager.getApplication().executeOnPooledThread {
                    val r = SkillsShHttp.search(query, 15)
                    ApplicationManager.getApplication().invokeLater {
                        postSkillSearchResult(postToWebView, gen, r.items, r.error)
                    }
                }
            }
            "openFile" -> {
                val path = root.get("fsPath")?.asString
                if (!path.isNullOrBlank()) {
                    openFile(project, path)
                }
            }
            "revealPath" -> {
                val path = root.get("fsPath")?.asString
                if (!path.isNullOrBlank()) {
                    revealPath(project, path)
                }
            }
            "installMcpRegistry" -> {
                val entry = root.get("entry")?.asJsonObject
                if (entry != null) {
                    val base = project.basePath?.let { Path(it) }
                    val err = McpRegistryInstall.installIntoWorkspace(base, entry)
                    if (err != null) {
                        notify(project, err, NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "installSkillSh" -> {
                val source = root.get("source")?.asString
                val skillId = root.get("skillId")?.asString
                val global = root.get("global")?.asBoolean == true
                if (!source.isNullOrBlank() && !skillId.isNullOrBlank()) {
                    val base = project.basePath?.let { Path(it) }
                    val err = SkillsCli.install(project, source, skillId, global, base)
                    if (err != null) {
                        notify(project, err, NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "setAutoScanMcpSkillsOnWorkspaceOpen" -> {
                val base = project.basePath?.let { Path(it) }
                ToolboxSettings(base).setAutoScanMcpSkills(root.get("value")?.asBoolean == true)
                HubStateService.postFullState(project, postToWebView)
            }
            "setThinkingMachineModeEnabled" -> {
                val base = project.basePath?.let { Path(it) }
                ToolboxSettings(base).setThinkingMachine(root.get("value")?.asBoolean == true)
                HubStateService.postFullState(project, postToWebView)
            }
            "mcpToggleServer" -> {
                val scope = if (root.get("scope")?.asString == "user") "user" else "workspace"
                val id = root.get("id")?.asString ?: ""
                val enable = root.get("enable")?.asBoolean == true
                if (id.isNotEmpty()) {
                    val err = if (enable) {
                        McpHubActions.turnOnServer(project, scope, id)
                    } else {
                        McpHubActions.turnOffServer(project, scope, id)
                    }
                    if (err != null && err != "cancelled") {
                        notify(project, err, NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "mcpDeleteServer" -> {
                val scope = if (root.get("scope")?.asString == "user") "user" else "workspace"
                val id = root.get("id")?.asString ?: ""
                if (id.isNotEmpty()) {
                    val err = McpHubActions.deleteServer(project, scope, id)
                    if (err != null && err != "cancelled") {
                        notify(project, err, NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "skillToggleHub" -> {
                val skillId = root.get("skillId")?.asString ?: ""
                val enable = root.get("enable")?.asBoolean == true
                if (skillId.isNotEmpty()) {
                    val base = project.basePath?.let { Path(it) }
                    SkillHubState(base).setDisabled(skillId, !enable)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "deleteSkillFolder" -> {
                val fsPath = root.get("fsPath")?.asString ?: ""
                val scope = if (root.get("scope")?.asString == "user") "user" else "workspace"
                if (fsPath.isNotEmpty()) {
                    val base = project.basePath?.let { Path(it) }
                    val err = SkillFolderDelete.deleteIfAllowed(project, base, scope, fsPath, SkillHubState(base))
                    when {
                        err == null -> notify(project, "Skill folder removed.", NotificationType.INFORMATION)
                        err == "cancelled" -> { }
                        else -> notify(project, err, NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            else -> LOG.debug("hub message ignored: $type")
        }
    }

    private fun openFile(project: Project, fsPath: String) {
        val vf = LocalFileSystem.getInstance().findFileByIoFile(File(fsPath)) ?: run {
            notify(project, "Could not open: $fsPath", NotificationType.WARNING)
            return
        }
        if (vf.isDirectory) {
            ProjectView.getInstance(project).select(null, vf, true)
        } else {
            FileEditorManager.getInstance(project).openFile(vf, true)
        }
    }

    private fun revealPath(project: Project, fsPath: String) {
        val vf = LocalFileSystem.getInstance().findFileByIoFile(File(fsPath)) ?: run {
            notify(project, "Could not reveal: $fsPath", NotificationType.WARNING)
            return
        }
        if (vf.isDirectory) {
            ProjectView.getInstance(project).select(null, vf, true)
        } else {
            RevealFileAction.openFile(File(fsPath))
        }
    }

    private fun notify(project: Project, text: String, type: NotificationType = NotificationType.INFORMATION) {
        Notifications.Bus.notify(
            Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type),
            project,
        )
    }

    private fun postRegistryResult(
        post: (JsonObject) -> Unit,
        generation: Int,
        append: Boolean,
        servers: JsonArray,
        nextCursor: String?,
        error: String?,
    ) {
        val o = JsonObject()
        o.addProperty("type", "registrySearchResult")
        o.addProperty("generation", generation)
        o.addProperty("append", append)
        o.add("servers", servers)
        if (nextCursor != null) {
            o.addProperty("nextCursor", nextCursor)
        }
        if (error != null) {
            o.addProperty("error", error)
        }
        post(o)
    }

    private fun postSkillSearchResult(
        post: (JsonObject) -> Unit,
        generation: Int,
        items: JsonArray,
        error: String?,
    ) {
        val o = JsonObject()
        o.addProperty("type", "skillSearchResult")
        o.addProperty("generation", generation)
        o.add("items", items)
        if (error != null) {
            o.addProperty("error", error)
        }
        post(o)
    }
}
