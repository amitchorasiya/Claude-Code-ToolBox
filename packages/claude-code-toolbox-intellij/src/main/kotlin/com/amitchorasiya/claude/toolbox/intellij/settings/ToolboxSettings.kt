package com.amitchorasiya.claude.toolbox.intellij.settings

import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists

/**
 * Project `.cloude/toolbox-settings.json` — mirrors VS Code `cloude-code-toolbox.*` keys used by the hub and parity layer.
 */
class ToolboxSettings(private val projectRoot: Path?) {

    private val gson = Gson()
    private val path: Path?
        get() = projectRoot?.resolve(".cloude")?.resolve("toolbox-settings.json")

    private fun load(): JsonObject {
        val p = path ?: return JsonObject()
        if (!p.exists()) return JsonObject()
        return try {
            JsonParser.parseString(Files.readString(p, StandardCharsets.UTF_8)).asJsonObject
        } catch (_: Exception) {
            JsonObject()
        }
    }

    private fun save(o: JsonObject) {
        val p = path ?: return
        p.parent?.createDirectories()
        Files.writeString(p, gson.toJson(o) + "\n", StandardCharsets.UTF_8)
    }

    fun getAutoScanMcpSkills(): Boolean = load().get("autoScanMcpSkillsOnWorkspaceOpen")?.asBoolean == true

    fun setAutoScanMcpSkills(value: Boolean) {
        val o = load()
        o.addProperty("autoScanMcpSkillsOnWorkspaceOpen", value)
        save(o)
    }

    fun getThinkingMachine(): Boolean = load().get("thinkingMachineModeEnabled")?.asBoolean == true

    fun setThinkingMachine(value: Boolean) {
        val o = load()
        o.addProperty("thinkingMachineModeEnabled", value)
        save(o)
    }

    /** Mirrors VS Code `thinkingMachineMode.runAwarenessScan` (default true). */
    fun getThinkingMachineRunAwarenessScan(): Boolean = boolKey("thinkingMachineRunAwarenessScan", true)

    /** Mirrors VS Code `thinkingMachineMode.mergeAwarenessIntoClaudeMd` (default true). */
    fun getThinkingMachineMergeAwarenessIntoClaudeMd(): Boolean =
        boolKey("thinkingMachineMergeAwarenessIntoClaudeMd", true)

    /** Mirrors VS Code `thinkingMachineMode.showConfirmationModal` (default true). */
    fun getThinkingMachineShowConfirmationModal(): Boolean =
        boolKey("thinkingMachineShowConfirmationModal", true)

    private fun boolKey(key: String, default: Boolean): Boolean {
        val v = load().get(key) ?: return default
        return if (v.isJsonNull) default else v.asBoolean
    }

    /** VS Code `cloude-code-toolbox.translateWrapMultilineInFence` (default false). */
    fun getTranslateWrapMultilineInFence(): Boolean = boolKey("translateWrapMultilineInFence", false)

    /** VS Code `cloude-code-toolbox.useInsidersPaths` — user `mcp.json` under Insiders vs stable. */
    fun getUseInsidersPaths(): Boolean = load().get("useInsidersPaths")?.asBoolean == true

    fun setUseInsidersPaths(value: Boolean) {
        val o = load()
        o.addProperty("useInsidersPaths", value)
        save(o)
    }

    /** VS Code `cloude-code-toolbox.npxTag` (default `latest`). */
    fun getNpxTag(): String {
        val t = load().get("npxTag")?.asString?.trim()
        return if (t.isNullOrEmpty()) "latest" else t
    }

    fun setNpxTag(value: String) {
        val o = load()
        o.addProperty("npxTag", value.ifBlank { "latest" })
        save(o)
    }

    /**
     * VS Code `cloude-code-toolbox.embeddedBridgeNodeExecutable` — optional absolute path to `node` for bundled bridge CLIs.
     * IntelliJ: used to run shipped `cursor-mcp-vscode-port`, `cursor-rules-to-claude`, `cloude-code-memory-bank` (default: `node` on PATH).
     */
    fun getEmbeddedBridgeNodeExecutable(): String = load().get("embeddedBridgeNodeExecutable")?.asString?.trim() ?: ""

    fun setEmbeddedBridgeNodeExecutable(value: String) {
        val o = load()
        o.addProperty("embeddedBridgeNodeExecutable", value.trim())
        save(o)
    }

    /** VS Code `cloude-code-toolbox.oneClickSetup` — stored as nested JSON object. */
    fun getOneClickSetup(): OneClickSetupModel {
        val el = load().get("oneClickSetup")
        if (el == null || !el.isJsonObject) return OneClickSetupModel()
        return try {
            val m = gson.fromJson(el, OneClickSetupModel::class.java) ?: OneClickSetupModel()
            normalizeOneClickSetupModel(m)
        } catch (_: Exception) {
            OneClickSetupModel()
        }
    }

    /** Merge-only migration: drop legacy overwrite / force enum values. */
    private fun normalizeOneClickSetupModel(m: OneClickSetupModel): OneClickSetupModel {
        var port = m.portCursorMcp
        if (port == "workspaceOverwrite") port = "workspaceMerge"
        if (port !in setOf("user", "workspaceMerge", "dry", "skip")) port = "user"
        var imb = m.initMemoryBankMode
        if (imb == "applyForce") imb = "apply"
        if (imb !in setOf("apply", "dryRun", "off")) imb = "apply"
        var sync = m.syncCursorRulesMode
        if (sync !in setOf("apply", "dryRun", "off")) sync = "apply"
        var skillsTarget = m.migrateSkillsTarget
        if (skillsTarget !in setOf("off", "workspace", "user", "both")) skillsTarget = "off"
        var skillsMode = m.migrateSkillsMode
        if (skillsMode !in setOf("copy", "move")) skillsMode = "copy"
        var ghTarget = m.migrateCopilotSkillsTarget
        if (ghTarget !in setOf("off", "workspace", "user", "both")) ghTarget = "workspace"
        var ghMode = m.migrateCopilotSkillsMode
        if (ghMode !in setOf("copy", "move")) ghMode = "copy"
        var mergePolicy = m.instructionMergeAfterOneClick
        if (mergePolicy !in setOf("enableAutoScan", "mergeClaudeMdOnce", "leaveUnchanged")) {
            mergePolicy = "enableAutoScan"
        }
        return m.copy(
            portCursorMcp = port,
            initMemoryBankMode = imb,
            syncCursorRulesMode = sync,
            migrateSkillsTarget = skillsTarget,
            migrateSkillsMode = skillsMode,
            migrateCopilotSkillsTarget = ghTarget,
            migrateCopilotSkillsMode = ghMode,
            instructionMergeAfterOneClick = mergePolicy,
        )
    }

    fun setOneClickSetup(model: OneClickSetupModel) {
        val o = load()
        val normalized = normalizeOneClickSetupModel(model)
        val tree = gson.toJsonTree(normalized)
        if (tree.isJsonObject) {
            o.add("oneClickSetup", tree.asJsonObject)
        }
        save(o)
    }

    fun userMcpJsonPath(): Path = McpPaths.userMcpJson()
}
