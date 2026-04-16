package com.amitchorasiya.claude.toolbox.intellij.hub

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
