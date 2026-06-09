package com.amitchorasiya.claude.toolbox.intellij.hub

import com.amitchorasiya.claude.toolbox.intellij.agents.*
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.RunRegistry
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.resolveClaudeBin
import com.amitchorasiya.claude.toolbox.intellij.intelligence.SafetyGuardsService
import com.amitchorasiya.claude.toolbox.intellij.intelligence.TokenOptimizationService
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpJson
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpStash
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.amitchorasiya.claude.toolbox.intellij.skills.LocalSkillsScanner
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillHubState
import com.amitchorasiya.claude.toolbox.intellij.workspace.WorkspaceKitSnapshot
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.Path
import kotlin.io.path.exists
import kotlin.io.path.isRegularFile

object HubStateService {

    fun postFullState(project: Project, postToWebView: (JsonObject) -> Unit) {
        val payload = gatherPayload(project)
        val envelope = JsonObject()
        envelope.addProperty("type", "state")
        envelope.add("payload", payload)
        postToWebView(envelope)
    }

    fun gatherPayload(project: Project): JsonObject {
        val base = project.basePath?.let { Path(it) }
        val home = Path(System.getProperty("user.home"))
        val settings = ToolboxSettings(base)
        val stashWs = base?.let { McpStash.Workspace(it) }
        val stashUser = McpStash.User()
        val skillHub = SkillHubState(base)

        val o = JsonObject()
        o.addProperty("hubHost", "intellij")
        o.addProperty("workspaceName", project.name)

        val wsUri = base?.let { McpPaths.workspaceMcpJson(it) }
        val userUri = settings.userMcpJsonPath()

        o.addProperty("workspaceMcp", mcpFileStatus(wsUri))
        o.addProperty("userMcp", mcpFileStatus(userUri))

        o.add("workspaceServers", buildMcpRows(wsUri, stashWs))
        o.add("userServers", buildMcpRows(userUri, stashUser))

        o.add("skills", LocalSkillsScanner.collect(home, base, skillHub))
        o.add("kit", WorkspaceKitSnapshot.gather(base))

        o.addProperty("autoScanMcpSkillsOnWorkspaceOpen", settings.getAutoScanMcpSkills())
        o.addProperty("thinkingMachineModeEnabled", settings.getThinkingMachine())
        o.addProperty("safetyGuardsEnabled", SafetyGuardsService.isEnabled())
        o.addProperty("tokenOptimizationEnabled", TokenOptimizationService.isEnabled())

        // Agent Teams state
        val agents = collectLocalAgents(home, base)
        val teams = collectLocalTeams(home, base)
        val commands = listInstalledCommands(home, base)
        o.add("agents", agentsToJsonArray(agents))
        o.add("teams", teamsToJsonArray(teams))
        o.add("slashCommands", commandsToJsonArray(commands))
        o.addProperty("agentTeamsEnabled", true)
        o.addProperty("agentTeamsDefaultProtocol", "native-task")
        o.addProperty("agentTeamsDefaultModel", "")

        val userAgentsDir = home.resolve(".claude/agents")
        val enableStatus = JsonObject()
        enableStatus.addProperty("agentsDirExists", userAgentsDir.toFile().isDirectory)
        enableStatus.addProperty("agentsDirPath", userAgentsDir.toString())
        enableStatus.addProperty("agentsCount", agents.size)
        val cliBin = resolveClaudeBin(null)
        enableStatus.addProperty("cliOk", cliBin != null)
        if (cliBin != null) enableStatus.addProperty("cliPath", cliBin)
        o.add("agentTeamsEnableStatus", enableStatus)

        val installedNames = agents.map { it.name }.toSet()
        val starterPack = JsonArray()
        for (sa in SDLC_STARTER_AGENTS) {
            val sp = JsonObject()
            sp.addProperty("id", sa.name)
            sp.addProperty("title", sa.name)
            sp.addProperty("role", sa.role)
            sp.addProperty("model", sa.model)
            sp.addProperty("color", sa.color)
            sp.addProperty("description", sa.description)
            sp.addProperty("defaultSelected", sa.defaultSelected)
            sp.addProperty("installed", sa.name in installedNames)
            starterPack.add(sp)
        }
        o.add("starterPack", starterPack)

        val activeRuns = JsonArray()
        for (r in RunRegistry.listActive()) {
            val ro = JsonObject()
            ro.addProperty("runId", r.runId)
            ro.addProperty("teamId", r.teamId)
            ro.addProperty("teamName", r.teamName)
            ro.addProperty("protocol", r.protocol)
            ro.addProperty("runtime", r.runtime)
            ro.addProperty("phase", r.phase)
            ro.addProperty("status", r.status)
            ro.addProperty("startedAt", r.startedAt)
            if (r.pendingApproval != null) ro.addProperty("awaitingApprovalPlanPath", r.pendingApproval!!.planPath)
            activeRuns.add(ro)
        }
        o.add("activeRuns", activeRuns)

        val hygiene = JsonObject()
        val wsRows = o.getAsJsonArray("workspaceServers")
        val usRows = o.getAsJsonArray("userServers")
        hygiene.addProperty(
            "workspaceMcpServerCount",
            countEnabled(wsRows),
        )
        hygiene.addProperty(
            "userMcpServerCount",
            countEnabled(usRows),
        )
        if (base != null) {
            val claude = base.resolve("CLAUDE.md")
            if (claude.exists() && claude.isRegularFile()) {
                val lines = try {
                    Files.readAllLines(claude).size
                } catch (_: Exception) {
                    null
                }
                hygiene.addProperty("claudeMdLines", lines)
                hygiene.addProperty("claudeMdMissing", false)
            } else {
                hygiene.add("claudeMdLines", null)
                hygiene.addProperty("claudeMdMissing", true)
            }
        } else {
            hygiene.add("claudeMdLines", null)
            hygiene.addProperty("claudeMdMissing", true)
        }
        o.add("hygiene", hygiene)

        if (base == null) {
            o.addProperty("hubLoadError", "No project base path — open a folder for full workspace MCP and kit.")
        }
        return o
    }

    private fun countEnabled(rows: JsonArray): Int {
        var n = 0
        for (el in rows) {
            if (!el.isJsonObject) continue
            if (el.asJsonObject.get("disabled")?.asBoolean != true) n++
        }
        return n
    }

    private fun mcpFileStatus(path: Path?): String {
        if (path == null || !path.exists() || !path.isRegularFile()) return "missing"
        val raw = McpJson.readDocument(path) ?: return "missing"
        val servers = McpJson.getServersObject(raw)
        return if (servers.size() == 0) "empty" else "ok"
    }

    private fun buildMcpRows(uri: Path?, stash: McpStash?): JsonArray {
        val arr = JsonArray()
        if (uri == null || stash == null) return arr
        val scope = when (stash) {
            is McpStash.Workspace -> "workspace"
            is McpStash.User -> "user"
        }
        val liveIds = mutableSetOf<String>()
        val raw = McpJson.readDocument(uri)
        if (raw != null) {
            val servers = McpJson.getServersObject(raw)
            for (id in servers.keySet()) {
                liveIds.add(id)
                val sum = McpJson.summarizeServer(id, servers.get(id))
                arr.add(mcpRow(id, sum, scope, false))
            }
        }
        for ((id, cfg) in stash.listStashed()) {
            if (liveIds.contains(id)) continue
            val sum = McpJson.summarizeServer(id, cfg)
            arr.add(mcpRow(id, sum, scope, true))
        }
        return arr
    }

    private fun mcpRow(id: String, sum: McpJson.ServerRow, scope: String, disabled: Boolean): JsonObject {
        val o = JsonObject()
        o.addProperty("id", id)
        o.addProperty("kind", sum.kind)
        o.addProperty("detail", sum.detail)
        o.addProperty("scope", scope)
        o.addProperty("disabled", disabled)
        return o
    }
}
