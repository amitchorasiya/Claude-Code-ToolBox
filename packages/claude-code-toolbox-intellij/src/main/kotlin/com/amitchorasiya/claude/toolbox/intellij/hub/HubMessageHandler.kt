package com.amitchorasiya.claude.toolbox.intellij.hub

import com.amitchorasiya.claude.toolbox.intellij.agents.*
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.AgentRunEvent
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.RunOrchestrator
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.RunRegistry
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

            // ── Agent Teams ──
            "agentTeams.installStarterPack" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val scope = root.get("scope")?.asString ?: "user"
                val selected = root.getAsJsonArray("selected")?.let { arr ->
                    (0 until arr.size()).mapNotNull { arr[it]?.asString }
                } ?: SDLC_STARTER_AGENTS.map { it.name }
                try {
                    val (written, skipped) = installStarterAgents(scope, home, base)
                    notify(project, "Starter pack: $written written, $skipped skipped.", NotificationType.INFORMATION)
                } catch (e: Exception) {
                    notify(project, "Starter pack error: ${e.message}", NotificationType.WARNING)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.createAgent" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                try {
                    createAgentFile(
                        name = root.get("name")?.asString ?: "",
                        description = root.get("description")?.asString ?: "",
                        role = root.get("role")?.asString ?: "both",
                        model = root.get("model")?.asString ?: "",
                        tools = root.getAsJsonArray("tools")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: emptyList(),
                        scope = root.get("scope")?.asString ?: "user",
                        homeDir = home, workspaceRoot = base,
                    )
                } catch (e: Exception) {
                    notify(project, "Create agent error: ${e.message}", NotificationType.WARNING)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.deleteAgent" -> {
                val fp = root.get("filePath")?.asString
                if (!fp.isNullOrBlank()) deleteAgentFile(fp)
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.createTeam" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                try {
                    createTeam(
                        name = root.get("name")?.asString ?: "",
                        description = root.get("description")?.asString ?: "",
                        protocol = root.get("protocol")?.asString ?: "native-task",
                        runtime = root.get("runtime")?.asString ?: runtimeForProtocol(root.get("protocol")?.asString ?: "native-task"),
                        maxTurns = root.get("maxTurns")?.asInt ?: 20,
                        agents = root.getAsJsonArray("agents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: emptyList(),
                        codePhaseAgents = root.getAsJsonArray("codePhaseAgents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: emptyList(),
                        judge = root.get("judge")?.asString?.takeIf { it.isNotEmpty() },
                        orchestrator = root.get("orchestrator")?.asString?.takeIf { it.isNotEmpty() },
                        scope = root.get("scope")?.asString ?: "user",
                        homeDir = home, workspaceRoot = base,
                    )
                } catch (e: Exception) {
                    notify(project, "Create team error: ${e.message}", NotificationType.WARNING)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.updateTeam" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val existingId = root.get("existingId")?.asString ?: ""
                val teams = collectLocalTeams(home, base)
                val existing = teams.find { it.id == existingId }
                if (existing != null) {
                    try {
                        updateTeam(existing,
                            name = root.get("name")?.asString ?: existing.name,
                            description = root.get("description")?.asString ?: existing.description,
                            protocol = root.get("protocol")?.asString ?: existing.protocol,
                            runtime = root.get("runtime")?.asString ?: existing.runtime,
                            maxTurns = root.get("maxTurns")?.asInt ?: existing.maxTurns,
                            agents = root.getAsJsonArray("agents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: existing.agents,
                            codePhaseAgents = root.getAsJsonArray("codePhaseAgents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: existing.codePhaseAgents,
                            judge = root.get("judge")?.asString?.takeIf { it.isNotEmpty() },
                            orchestrator = root.get("orchestrator")?.asString?.takeIf { it.isNotEmpty() },
                        )
                    } catch (e: Exception) {
                        notify(project, "Update team error: ${e.message}", NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.deleteTeam" -> {
                val fp = root.get("filePath")?.asString
                if (!fp.isNullOrBlank()) deleteTeam(fp)
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.installCommandsPack" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val scope = root.get("scope")?.asString ?: "user"
                val selected = root.getAsJsonArray("selected")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: commandsPackDefaultSelection()
                val overwrite = root.get("overwrite")?.asBoolean == true
                try {
                    val (written, skipped) = installCommandsPack(selected, scope, home, base, overwrite)
                    notify(project, "Slash commands: $written written, $skipped skipped.", NotificationType.INFORMATION)
                } catch (e: Exception) {
                    notify(project, "Commands pack error: ${e.message}", NotificationType.WARNING)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.syncTeamCommand" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val teamName = root.get("teamName")?.asString ?: ""
                val scope = root.get("scope")?.asString ?: "user"
                val agentNames = root.getAsJsonArray("agents")?.let { arr ->
                    (0 until arr.size()).mapNotNull { arr[it]?.asString }
                } ?: emptyList()
                if (teamName.isNotEmpty()) {
                    val slug = teamName.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
                    val commands = listInstalledCommands(home, base)
                    val existing = commands.find { it.id == slug }
                    val body = buildTeamCommandBody(teamName, agentNames)
                    val draft = CommandDraft(
                        name = slug,
                        description = "Run the \"$teamName\" agent team",
                        argumentHint = "<task description>",
                        agents = agentNames,
                        instructions = body,
                        scope = scope,
                    )
                    try {
                        if (existing != null) {
                            updateCommand(existing, draft, home, base)
                        } else {
                            createCommand(draft, home, base)
                        }
                    } catch (e: Exception) {
                        notify(project, "Sync team command error: ${e.message}", NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.createCommand" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                try {
                    createCommand(CommandDraft(
                        name = root.get("name")?.asString ?: "",
                        description = root.get("description")?.asString ?: "",
                        argumentHint = root.get("argumentHint")?.asString ?: "",
                        agents = root.getAsJsonArray("agents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: emptyList(),
                        instructions = root.get("instructions")?.asString ?: "",
                        scope = root.get("scope")?.asString ?: "user",
                    ), home, base)
                } catch (e: Exception) {
                    notify(project, "Create command error: ${e.message}", NotificationType.WARNING)
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.updateCommand" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val existingId = root.get("existingId")?.asString ?: ""
                val commands = listInstalledCommands(home, base)
                val existing = commands.find { it.id == existingId }
                if (existing != null) {
                    try {
                        updateCommand(existing, CommandDraft(
                            name = root.get("name")?.asString ?: existing.id,
                            description = root.get("description")?.asString ?: (existing.description ?: ""),
                            argumentHint = root.get("argumentHint")?.asString ?: (existing.argumentHint ?: ""),
                            agents = root.getAsJsonArray("agents")?.let { arr -> (0 until arr.size()).mapNotNull { arr[it]?.asString } } ?: emptyList(),
                            instructions = root.get("instructions")?.asString ?: "",
                            scope = existing.scope,
                        ), home, base)
                    } catch (e: Exception) {
                        notify(project, "Update command error: ${e.message}", NotificationType.WARNING)
                    }
                }
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.deleteCommand" -> {
                val fp = root.get("filePath")?.asString
                if (!fp.isNullOrBlank()) deleteCommand(fp)
                HubStateService.postFullState(project, postToWebView)
            }
            "agentTeams.readCommandBody" -> {
                val fp = root.get("filePath")?.asString ?: ""
                val cmdId = root.get("commandId")?.asString ?: ""
                if (fp.isNotEmpty()) {
                    val body = readCommandBody(fp)
                    val agents = parseAgentsFromBody(body)
                    val resp = JsonObject()
                    resp.addProperty("type", "agentTeams.commandBody")
                    resp.addProperty("commandId", cmdId)
                    resp.addProperty("body", body)
                    val agArr = JsonArray(); agents.forEach { agArr.add(it) }
                    resp.add("agents", agArr)
                    postToWebView(resp)
                }
            }
            "agentTeams.revealAgentsFolder" -> {
                val scope = root.get("scope")?.asString ?: "user"
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val dir = agentsDirForScope(scope, home, base)
                if (dir != null) revealPath(project, dir.toString())
            }
            "agentTeams.openAgentFile" -> {
                val fp = root.get("filePath")?.asString
                if (!fp.isNullOrBlank()) openFile(project, fp)
            }
            "agentTeams.runTeam" -> {
                val home = java.nio.file.Path.of(System.getProperty("user.home"))
                val base = project.basePath?.let { java.nio.file.Path.of(it) }
                val teamId = root.get("teamId")?.asString ?: ""
                val prompt = root.get("prompt")?.asString ?: ""
                if (teamId.isNotBlank() && prompt.isNotBlank()) {
                    val teams = collectLocalTeams(home, base)
                    val team = teams.find { it.id == teamId }
                    if (team != null) {
                        val agents = collectLocalAgents(home, base)
                        ApplicationManager.getApplication().executeOnPooledThread {
                            try {
                                val result = RunOrchestrator.startTeamRun(RunOrchestrator.StartRunOptions(
                                    team = team, agents = agents, userPrompt = prompt,
                                    workspaceRoot = base?.toString(),
                                ))
                                val run = result.run
                                val off = run.bus.on { ev ->
                                    ApplicationManager.getApplication().invokeLater {
                                        val evObj = ev.toJson()
                                        evObj.addProperty("type", "agentTeams.runEvent")
                                        postToWebView(evObj)
                                        if (ev is AgentRunEvent.PhaseBoundary && ev.needsApproval) {
                                            val pb = JsonObject()
                                            pb.addProperty("type", "agentTeams.phaseBoundary")
                                            pb.addProperty("runId", ev.runId)
                                            pb.addProperty("needsApproval", true)
                                            if (ev.planPath != null) pb.addProperty("planPath", ev.planPath)
                                            postToWebView(pb)
                                        }
                                    }
                                }
                                val startMsg = JsonObject()
                                startMsg.addProperty("type", "agentTeams.runStarted")
                                startMsg.addProperty("runId", run.runId)
                                ApplicationManager.getApplication().invokeLater { postToWebView(startMsg) }
                                val finished = result.finished.get()
                                off()
                                val endMsg = JsonObject()
                                endMsg.addProperty("type", "agentTeams.runEnded")
                                endMsg.addProperty("runId", run.runId)
                                endMsg.addProperty("status", finished.status)
                                if (finished.planArtifactPath != null) endMsg.addProperty("planArtifactPath", finished.planArtifactPath)
                                ApplicationManager.getApplication().invokeLater {
                                    postToWebView(endMsg)
                                    HubStateService.postFullState(project, postToWebView)
                                }
                            } catch (e: Exception) {
                                LOG.warn("Team run failed", e)
                                ApplicationManager.getApplication().invokeLater {
                                    notify(project, "Team run error: ${e.message}", NotificationType.WARNING)
                                }
                            }
                        }
                    } else {
                        notify(project, "Team not found: $teamId", NotificationType.WARNING)
                    }
                }
            }
            "agentTeams.stopRun" -> {
                val runId = root.get("runId")?.asString ?: ""
                val run = RunRegistry.get(runId)
                if (run != null) RunOrchestrator.abortRun(run)
            }
            "agentTeams.approvePlan", "agentTeams.rejectPlan" -> {
                val runId = root.get("runId")?.asString ?: ""
                val run = RunRegistry.get(runId)
                if (run != null) {
                    val decision = if (type == "agentTeams.approvePlan") "approve" else "reject"
                    val reason = root.get("reason")?.asString
                    RunOrchestrator.resolvePendingApproval(run, decision, reason)
                }
            }
            "agentTeams.openRun" -> {
                val runId = root.get("runId")?.asString ?: ""
                val run = RunRegistry.get(runId)
                if (run != null) openFile(project, run.jsonlPath)
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
