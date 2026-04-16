package com.amitchorasiya.claude.toolbox.intellij.wizard

import com.amitchorasiya.claude.toolbox.intellij.cli.BundledBridgeCli
import com.amitchorasiya.claude.toolbox.intellij.cli.ToolboxNodeRunner
import com.amitchorasiya.claude.toolbox.intellij.hub.ClaudeHubBridge
import com.amitchorasiya.claude.toolbox.intellij.hub.HubFileOpener
import com.amitchorasiya.claude.toolbox.intellij.intelligence.McpSkillsAwarenessIntellij
import com.amitchorasiya.claude.toolbox.intellij.intelligence.ReadinessIntellij
import com.amitchorasiya.claude.toolbox.intellij.parity.ClaudeToolboxConfigScanIntellij
import com.amitchorasiya.claude.toolbox.intellij.parity.AppendCursorrulesIntellij
import com.amitchorasiya.claude.toolbox.intellij.parity.MergeCopilotInstructionsIntellij
import com.amitchorasiya.claude.toolbox.intellij.parity.RunFirstTestTaskIntellij
import com.amitchorasiya.claude.toolbox.intellij.settings.OneClickSetupModel
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.amitchorasiya.claude.toolbox.intellij.skills.MigrateSkillMode
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillsCursorToAgentsMigration
import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Executes One Click Setup in the same order as
 * [packages/cloude-code-toolbox/src/commands/oneClickSetup.ts].
 */
object OneClickSetupRunner {

    fun run(project: Project, model: OneClickSetupModel) {
        val basePath = project.basePath ?: run {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val base = Paths.get(basePath)
        val home = Paths.get(System.getProperty("user.home"))
        var settings = ToolboxSettings(base)
        val bridge = project.getService(ClaudeHubBridge::class.java)
        val notes = mutableListOf<String>()
        val normalized = normalizeModelForMergeOnly(model, notes)

        settings.setOneClickSetup(normalized)

        try {
            // --- Cursor → Claude Code ---
            val migrateCursorSkills = normalized.migrateFromCursor && normalized.migrateSkillsTarget != "off"
            if (migrateCursorSkills) {
                val mode = if (normalized.migrateSkillsMode == "move") MigrateSkillMode.MOVE else MigrateSkillMode.COPY
                when (normalized.migrateSkillsTarget) {
                    "workspace" -> {
                        val r = SkillsCursorToAgentsMigration.runForRoot(base, mode)
                        if (r.errors > 0) notes.add("[Cursor] skills: ${r.errors} error(s) under ${r.skillsSourcePath}")
                    }
                    "user" -> {
                        val r = SkillsCursorToAgentsMigration.runForRoot(home, mode)
                        if (r.errors > 0) notes.add("[Cursor] skills: ${r.errors} error(s) under ${r.skillsSourcePath}")
                    }
                    "both" -> {
                        val r1 = SkillsCursorToAgentsMigration.runForRoot(base, mode)
                        val r2 = SkillsCursorToAgentsMigration.runForRoot(home, mode)
                        if (r1.errors > 0) notes.add("[Cursor] skills: ${r1.errors} error(s) under ${r1.skillsSourcePath}")
                        if (r2.errors > 0) notes.add("[Cursor] skills: ${r2.errors} error(s) under ${r2.skillsSourcePath}")
                    }
                }
                bridge.refreshHub()
            }

            val syncRules = normalized.migrateFromCursor && normalized.syncCursorRulesMode != "off"
            if (syncRules) {
                val args = mutableListOf("--cwd", base.toString())
                if (normalized.syncCursorRulesMode == "dryRun") {
                    args.add("--dry-run")
                }
                val err = ToolboxNodeRunner.runBundledToolboxBridge(
                    project,
                    base,
                    BundledBridgeCli.CURSOR_RULES_TO_CLAUDE,
                    args,
                    "Cursor rules → CLAUDE.md",
                    settings,
                )
                err?.let { notes.add("[Cursor] rules: $it") }
                bridge.refreshHub()
            }

            if (normalized.migrateFromCursor && normalized.appendCursorrules) {
                if (!AppendCursorrulesIntellij.mergeSilent(project)) {
                    /* no .cursorrules — skip quietly */
                }
            }

            if (normalized.migrateFromCursor) {
                val portArgs = portCursorMcpArgs(settings, normalized.portCursorMcp)
                if (portArgs != null) {
                    val err = ToolboxNodeRunner.runBundledToolboxBridge(
                        project,
                        base,
                        BundledBridgeCli.CURSOR_MCP_PORT,
                        portArgs,
                        "Cursor MCP port",
                        settings,
                    )
                    err?.let { notes.add("[Cursor] MCP port: $it") }
                    bridge.refreshHub()
                }
            }

            // --- GitHub Copilot → Claude Code ---
            if (normalized.migrateFromGitHubCopilot && normalized.mergeCopilotInstructionsIntoClaudeMd) {
                if (!MergeCopilotInstructionsIntellij.mergeSilent(project)) {
                    notes.add("[Copilot] skip: .github/copilot-instructions.md missing or empty")
                }
            }

            val migrateCopilotSkills =
                normalized.migrateFromGitHubCopilot && normalized.migrateCopilotSkillsTarget != "off"
            if (migrateCopilotSkills) {
                val mode = if (normalized.migrateCopilotSkillsMode == "move") MigrateSkillMode.MOVE else MigrateSkillMode.COPY
                when (normalized.migrateCopilotSkillsTarget) {
                    "workspace" -> {
                        val r = SkillsCursorToAgentsMigration.runForGithubSkillsRoot(base, mode)
                        if (r.errors > 0) notes.add("[Copilot] skills: ${r.errors} error(s) under ${r.skillsSourcePath}")
                    }
                    "user" -> {
                        val r = SkillsCursorToAgentsMigration.runForUserCopilotSkills(home, mode)
                        if (r.errors > 0) notes.add("[Copilot] skills: ${r.errors} error(s) under ${r.skillsSourcePath}")
                    }
                    "both" -> {
                        val r1 = SkillsCursorToAgentsMigration.runForGithubSkillsRoot(base, mode)
                        val r2 = SkillsCursorToAgentsMigration.runForUserCopilotSkills(home, mode)
                        if (r1.errors > 0) notes.add("[Copilot] skills: ${r1.errors} error(s) under ${r1.skillsSourcePath}")
                        if (r2.errors > 0) notes.add("[Copilot] skills: ${r2.errors} error(s) under ${r2.skillsSourcePath}")
                    }
                }
                bridge.refreshHub()
            }

            // --- Shared: memory bank ---
            val initMb = normalized.initMemoryBankMode != "off"
            if (initMb) {
                val args = mutableListOf("init", "--cwd", base.toString())
                when (normalized.initMemoryBankMode) {
                    "dryRun" -> args.add("--dry-run")
                }
                if (normalized.migrateFromCursor && normalized.initMemoryBankCursorRules) {
                    args.add("--cursor-rules")
                }
                val err = ToolboxNodeRunner.runBundledToolboxBridge(
                    project,
                    base,
                    BundledBridgeCli.CLOUDE_CODE_MEMORY_BANK,
                    args,
                    "Memory bank init",
                    settings,
                )
                err?.let { notes.add("Memory bank: $it") }
                bridge.refreshHub()
            }

            if (normalized.instructionMergeAfterOneClick == "enableAutoScan") {
                settings.setAutoScanMcpSkills(true)
            }
            settings = ToolboxSettings(base)

            if (normalized.runAwarenessScan) {
                val forceOnce = normalized.instructionMergeAfterOneClick == "mergeClaudeMdOnce"
                val shouldMerge =
                    settings.getAutoScanMcpSkills() || forceOnce
                McpSkillsAwarenessIntellij.runScan(
                    project,
                    mergeIntoClaudeMd = shouldMerge,
                    openAwarenessInEditor = false,
                )
            }

            if (normalized.runReadiness) {
                ReadinessIntellij.runAndOpenReport(project)
            }

            if (normalized.runConfigScan) {
                ClaudeToolboxConfigScanIntellij.run(project, settings)
            }

            if (normalized.runFirstTestTask) {
                RunFirstTestTaskIntellij.run(project, base)
            }

            bridge.refreshHub()

            if (normalized.migrateFromGitHubCopilot && normalized.copilotMcpReminderAfterOneClick) {
                val n = Notification(
                    "CloudeCodeToolBox",
                    "Claude Code ToolBox",
                    "VS Code `mcp.json` is for the editor; Claude Code uses `/mcp` in the Claude panel. Align servers in both places if needed.",
                    NotificationType.INFORMATION,
                )
                n.addAction(object : NotificationAction("Open user mcp.json") {
                    override fun actionPerformed(e: AnActionEvent, notification: Notification) {
                        HubFileOpener.openUserMcp(project)
                    }
                })
                Notifications.Bus.notify(n, project)
            }

            val msg = if (notes.isNotEmpty()) {
                "One Click Setup finished. Notes: ${notes.joinToString(" · ")}"
            } else {
                "One Click Setup finished. Review Run tool windows, opened scans, and CLAUDE.md."
            }
            notify(project, msg, NotificationType.INFORMATION)
        } catch (e: Exception) {
            notify(project, "One Click Setup failed: ${e.message}", NotificationType.ERROR)
        }
    }

    private fun portCursorMcpArgs(settings: ToolboxSettings, mode: String): List<String>? =
        when (mode) {
            "skip" -> null
            "dry" -> listOf("--dry-run")
            "user" -> listOf("-t", if (settings.getUseInsidersPaths()) "insiders" else "user")
            "workspaceOverwrite", "workspaceMerge" -> emptyList()
            else -> listOf("-t", if (settings.getUseInsidersPaths()) "insiders" else "user")
        }

    private fun notify(project: Project, text: String, type: NotificationType) {
        Notifications.Bus.notify(Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type), project)
    }

    private fun normalizeModelForMergeOnly(
        model: OneClickSetupModel,
        notes: MutableList<String>,
    ): OneClickSetupModel {
        var out = model
        if (out.portCursorMcp == "workspaceOverwrite") {
            notes.add("[One Click] portCursorMcp \"workspaceOverwrite\" downgraded to \"workspaceMerge\" (merge-safe).")
            out = out.copy(portCursorMcp = "workspaceMerge")
        }
        val validPort = setOf("user", "workspaceMerge", "dry", "skip")
        if (!validPort.contains(out.portCursorMcp)) {
            notes.add("[One Click] portCursorMcp \"${out.portCursorMcp}\" is invalid; using \"user\" (merge-safe).")
            out = out.copy(portCursorMcp = "user")
        }

        if (out.initMemoryBankMode == "applyForce") {
            notes.add("[One Click] initMemoryBankMode \"applyForce\" downgraded to \"apply\" (merge-safe).")
            out = out.copy(initMemoryBankMode = "apply")
        }
        val validMemory = setOf("apply", "dryRun", "off")
        if (!validMemory.contains(out.initMemoryBankMode)) {
            notes.add("[One Click] initMemoryBankMode \"${out.initMemoryBankMode}\" is invalid; using \"apply\".")
            out = out.copy(initMemoryBankMode = "apply")
        }

        fun sanitize(
            value: String,
            allowed: Set<String>,
            fallback: String,
            key: String,
        ): String {
            if (allowed.contains(value)) return value
            notes.add("[One Click] $key \"$value\" is invalid; using \"$fallback\" (merge-safe).")
            return fallback
        }

        return out.copy(
            migrateSkillsTarget = sanitize(out.migrateSkillsTarget, setOf("off", "workspace", "user", "both"), "off", "migrateSkillsTarget"),
            migrateSkillsMode = sanitize(out.migrateSkillsMode, setOf("copy", "move"), "copy", "migrateSkillsMode"),
            syncCursorRulesMode = sanitize(out.syncCursorRulesMode, setOf("apply", "dryRun", "off"), "apply", "syncCursorRulesMode"),
            migrateCopilotSkillsTarget = sanitize(
                out.migrateCopilotSkillsTarget,
                setOf("off", "workspace", "user", "both"),
                "workspace",
                "migrateCopilotSkillsTarget",
            ),
            migrateCopilotSkillsMode = sanitize(out.migrateCopilotSkillsMode, setOf("copy", "move"), "copy", "migrateCopilotSkillsMode"),
            instructionMergeAfterOneClick = sanitize(
                out.instructionMergeAfterOneClick,
                setOf("enableAutoScan", "mergeClaudeMdOnce", "leaveUnchanged"),
                "enableAutoScan",
                "instructionMergeAfterOneClick",
            ),
        )
    }
}
