package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.cli.BundledBridgeCli
import com.amitchorasiya.claude.toolbox.intellij.cli.ToolboxNodeRunner
import com.amitchorasiya.claude.toolbox.intellij.hub.ClaudeHubBridge
import com.amitchorasiya.claude.toolbox.intellij.hub.HubFileOpener
import com.amitchorasiya.claude.toolbox.intellij.intelligence.ComposerHubIntellij
import com.amitchorasiya.claude.toolbox.intellij.intelligence.ContextPackIntellij
import com.amitchorasiya.claude.toolbox.intellij.intelligence.McpSkillsAwarenessIntellij
import com.amitchorasiya.claude.toolbox.intellij.intelligence.ReadinessIntellij
import com.amitchorasiya.claude.toolbox.intellij.intelligence.SessionNotepadIntellij
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettingsConfigurable
import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.amitchorasiya.claude.toolbox.intellij.skills.MigrateSkillMode
import com.amitchorasiya.claude.toolbox.intellij.skills.ScopeRun
import com.amitchorasiya.claude.toolbox.intellij.skills.SkillsCursorToAgentsMigration
import com.amitchorasiya.claude.toolbox.intellij.vscode.VscodeWorkspaceSettingsJson
import com.amitchorasiya.claude.toolbox.intellij.wizard.OneClickSetupWizardDialog
import com.intellij.ide.BrowserUtil
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Routes every `CloudeCodeToolBox.*` command to the closest VS Code behavior:
 * Run-tool-window `npx` where the extension uses terminals, IDE file/URL actions elsewhere,
 * and clear notices when a flow depends on VS Code–only APIs.
 */
object ToolboxParityDispatcher {

    private const val REGISTRY_URL = "https://registry.modelcontextprotocol.io"
    private const val REPO_ROOT = "https://github.com/amitchorasiya/Cloude-Code-ToolBox"

    fun dispatch(project: Project, commandId: String) {
        val basePath = project.basePath
        val base = basePath?.let { Paths.get(it) }
        val settings = ToolboxSettings(base)
        val bridge = project.getService(ClaudeHubBridge::class.java)

        when (commandId) {
            "CloudeCodeToolBox.refreshMcpView", "CloudeCodeToolBox.refreshWorkspaceView" -> bridge.refreshHub()

            "CloudeCodeToolBox.openWorkspaceMcp" -> HubFileOpener.openWorkspaceMcp(project)
            "CloudeCodeToolBox.openUserMcp" -> HubFileOpener.openUserMcp(project)
            "CloudeCodeToolBox.openClaudeUserSettingsJson" -> HubFileOpener.openClaudeUserSettings(project)
            "CloudeCodeToolBox.openThinkingMachineModeSettings",
            "CloudeCodeToolBox.openIntelligenceSettings",
            "CloudeCodeToolBox.openOneClickSetupSettings",
            -> ShowSettingsUtil.getInstance().showSettingsDialog(project, ToolboxSettingsConfigurable::class.java, null)

            "CloudeCodeToolBox.mcpBrowseRegistry" -> BrowserUtil.browse(REGISTRY_URL)
            "CloudeCodeToolBox.mcpListServers" -> McpServersUiIntellij.listServers(project)
            "CloudeCodeToolBox.mcpAddServer" -> McpServersUiIntellij.addServer(project, settings)

            "CloudeCodeToolBox.portCursorMcp" -> portCursorMcp(project, base, settings)
            "CloudeCodeToolBox.manualPortCursorMcpWithoutNpx" -> portCursorMcp(project, base, settings)

            "CloudeCodeToolBox.syncCursorRules" -> syncCursorRules(project, base, settings)
            "CloudeCodeToolBox.cursorRulesToClaudeWithoutNpx" -> syncCursorRules(project, base, settings)

            "CloudeCodeToolBox.initMemoryBank" -> initMemoryBankInteractive(project, base, settings)
            "CloudeCodeToolBox.memoryBankWithoutNpx" -> initMemoryBankInteractive(project, base, settings)

            "CloudeCodeToolBox.toggleMcpDiscovery" -> toggleMcpDiscovery(project, base)

            "CloudeCodeToolBox.openIntelligenceToolboxRepos" -> pickIntelligenceRepo(project)
            "CloudeCodeToolBox.openIntelligenceRepoMcpPort" -> BrowserUtil.browse("https://github.com/amitchorasiya/Github-Copilot-ToolBox")
            "CloudeCodeToolBox.openIntelligenceRepoMemoryBank" -> BrowserUtil.browse("https://github.com/amitchorasiya/Github-Copilot-Memory-Bank")
            "CloudeCodeToolBox.openIntelligenceRepoRulesConverter" -> BrowserUtil.browse(
                "https://github.com/amitchorasiya/Github-Copilot-Cursor-Rules-Converter",
            )

            "CloudeCodeToolBox.migrateSkillsCursorToAgents" -> migrateCursorSkills(project, base, bridge)
            "CloudeCodeToolBox.migrateCopilotSkillsToAgents" -> migrateCopilotSkillsToAgents(project, base, bridge)

            "CloudeCodeToolBox.revealSkillFoldersWithoutNpx" -> revealIfExists(project, base, ".cursor/skills")
            "CloudeCodeToolBox.revealCopilotSkillFoldersWithoutNpx" -> {
                revealIfExists(project, base, ".github/skills")
                val home = Paths.get(System.getProperty("user.home"))
                revealIfExists(project, home, ".copilot/skills")
            }

            "CloudeCodeToolBox.createCursorrulesTemplate" -> createCursorrulesTemplate(project, base)

            "CloudeCodeToolBox.workspaceSetupWizard", "CloudeCodeToolBox.runOneClickSetup" -> {
                if (project.basePath == null) {
                    notify(project, "Open a workspace folder first.", NotificationType.WARNING)
                } else {
                    OneClickSetupWizardDialog(project).show()
                }
            }

            "CloudeCodeToolBox.openClaudeCode", "CloudeCodeToolBox.openClaudeCodePanel" -> BrowserUtil.browse("https://claude.ai/code")

            "CloudeCodeToolBox.openCursorClaudeReference" -> BrowserUtil.browse("$REPO_ROOT/blob/main/README.md")
            "CloudeCodeToolBox.openClaudeCodeAccountDocs" -> BrowserUtil.browse("https://docs.anthropic.com/en/docs/claude-code")

            "CloudeCodeToolBox.openEnvSyncChecklist" -> BrowserUtil.browse("$REPO_ROOT/blob/main/packages/cloude-code-toolbox/README.md")

            "CloudeCodeToolBox.openComposerHub" -> ComposerHubIntellij.show(project)
            "CloudeCodeToolBox.openSessionNotepad" -> SessionNotepadIntellij.open(project)
            "CloudeCodeToolBox.copySessionNotepad" -> SessionNotepadIntellij.copyToClipboard(project)

            "CloudeCodeToolBox.buildContextPack" -> ContextPackIntellij.buildAndCopy(project)
            "CloudeCodeToolBox.showIntelligenceReadiness" -> ReadinessIntellij.runAndOpenReport(project)
            "CloudeCodeToolBox.showMcpSkillsAwareness" -> showMcpSkillsAwarenessInteractive(project)
            "CloudeCodeToolBox.runThinkingMachinePriming" -> runThinkingMachinePriming(project, settings)

            "CloudeCodeToolBox.openInlineChatCursorStyle" ->
                vscodeOnlyPanel(project, "Inline chat uses VS Code’s chat API. Use JetBrains AI Assistant or the terminal Claude Code flow.")

            "CloudeCodeToolBox.translateContextSelection" -> TranslateContextIntellij.run(project, settings)
            "CloudeCodeToolBox.appendNotepadToMemoryBank" -> NotepadToMemoryBankIntellij.run(project)
            "CloudeCodeToolBox.claudeToolboxConfigScan" -> ClaudeToolboxConfigScanIntellij.run(project, settings)

            "CloudeCodeToolBox.openInstructionsPicker" -> InstructionsPickerIntellij.open(project)
            "CloudeCodeToolBox.appendCursorrules" -> AppendCursorrulesIntellij.run(project)
            "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd" -> MergeCopilotInstructionsIntellij.run(project)

            "CloudeCodeToolBox.createSkillStub" -> SkillStubIntellij.run(project)
            "CloudeCodeToolBox.verificationChecklist" -> VerificationChecklistIntellij.run(project)
            "CloudeCodeToolBox.applyBundledMcpRecipe" -> BundledMcpRecipeIntellij.run(project)
            "CloudeCodeToolBox.runFirstWorkspaceTestTask" -> RunFirstTestTaskIntellij.run(project, base)

            else -> notify(
                project,
                "Command $commandId — if something is missing, open the same workspace in VS Code or see $REPO_ROOT",
                NotificationType.INFORMATION,
            )
        }
    }

    /** Interactive palette / hub — matches VS Code non-silent scan (merge on, open report). */
    private fun showMcpSkillsAwarenessInteractive(project: Project) {
        if (project.basePath == null) {
            notify(project, "MCP & Skills awareness: open a workspace folder to save the report.", NotificationType.WARNING)
            return
        }
        McpSkillsAwarenessIntellij.runScan(project, mergeIntoClaudeMd = true, openAwarenessInEditor = true)
        notify(
            project,
            "MCP & Skills awareness saved to .claude/cloude-code-toolbox-mcp-skills-awareness.md.",
            NotificationType.INFORMATION,
        )
    }

    /** Optional awareness scan (silent tab) + context pack, per Thinking Machine settings. */
    private fun runThinkingMachinePriming(project: Project, settings: ToolboxSettings) {
        if (project.basePath == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        if (!settings.getThinkingMachine()) {
            notify(
                project,
                "Thinking Machine Mode is off. Enable it in Settings → Tools → Claude Code ToolBox, then try again.",
                NotificationType.WARNING,
            )
            return
        }
        val runScan = settings.getThinkingMachineRunAwarenessScan()
        val mergeBlock = settings.getThinkingMachineMergeAwarenessIntoClaudeMd()
        val showPre = settings.getThinkingMachineShowConfirmationModal()
        if (showPre) {
            val ok = Messages.showYesNoDialog(
                project,
                "This may write or update files under .claude/ and CLAUDE.md, copy a context pack to the clipboard, and refresh the hub.",
                "Run Thinking Machine priming?",
                Messages.getWarningIcon(),
            )
            if (ok != Messages.YES) {
                return
            }
        }
        if (runScan) {
            val shouldMerge = settings.getAutoScanMcpSkills() || mergeBlock
            McpSkillsAwarenessIntellij.runScan(
                project,
                mergeIntoClaudeMd = shouldMerge,
                openAwarenessInEditor = false,
            )
        }
        ContextPackIntellij.buildAndCopy(project)
        notify(
            project,
            "Thinking Machine priming finished. Context pack is on the clipboard — paste into Claude Code.",
            NotificationType.INFORMATION,
        )
    }

    private fun portCursorMcp(project: Project, base: Path?, settings: ToolboxSettings) {
        if (base == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val opts = arrayOf(
            "Workspace .vscode/mcp.json (merge with existing)",
            "User mcp.json (merge with existing)",
            "Dry run (print JSON only)",
        )
        val idx = ToolboxDialogUi.showChooseDialog(
            project,
            "Port Cursor MCP → VS Code mcp.json (bundled cursor-mcp-vscode-port). Existing files are always merged, never replaced.",
            "Claude Code ToolBox",
            Messages.getQuestionIcon(),
            opts,
            opts[0],
        )
        val args = when (idx) {
            0 -> emptyList()
            1 -> listOf("-t", if (settings.getUseInsidersPaths()) "insiders" else "user")
            2 -> listOf("--dry-run")
            else -> return
        }
        val err = ToolboxNodeRunner.runBundledToolboxBridge(
            project,
            base,
            BundledBridgeCli.CURSOR_MCP_PORT,
            args,
            "Cursor MCP port",
            settings,
        )
        err?.let { notify(project, it, NotificationType.WARNING) }
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun syncCursorRules(project: Project, base: Path?, settings: ToolboxSettings) {
        if (base == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val dry = Messages.showYesNoDialog(
            "Use --dry-run (preview only, no file writes)?",
            "Sync Cursor rules → CLAUDE.md",
            Messages.getQuestionIcon(),
        )
        val args = mutableListOf("--cwd", base.toString())
        if (dry == Messages.YES) {
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
        err?.let { notify(project, it, NotificationType.WARNING) }
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun initMemoryBankInteractive(project: Project, base: Path?, settings: ToolboxSettings) {
        if (base == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val dry = Messages.showYesNoDialog(
            "Preview only (--dry-run, no files written)?",
            "Memory bank (cloude-code-memory-bank)",
            Messages.getQuestionIcon(),
        )
        val cursorRules = Messages.showYesNoDialog(
            "Also merge .cursor/rules into prompts (--cursor-rules)?",
            "Memory bank",
            Messages.getQuestionIcon(),
        )
        val flags = mutableListOf<String>()
        if (dry == Messages.YES) flags.add("--dry-run")
        if (cursorRules == Messages.YES) flags.add("--cursor-rules")
        val args = mutableListOf("init", "--cwd", base.toString())
        args.addAll(flags)
        val err = ToolboxNodeRunner.runBundledToolboxBridge(
            project,
            base,
            BundledBridgeCli.CLOUDE_CODE_MEMORY_BANK,
            args,
            "Memory bank init",
            settings,
        )
        err?.let { notify(project, it, NotificationType.WARNING) }
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun toggleMcpDiscovery(project: Project, base: Path?) {
        if (base == null) {
            notify(project, "Open a workspace folder to write .vscode/settings.json.", NotificationType.WARNING)
            return
        }
        val err = VscodeWorkspaceSettingsJson.toggleChatMcpDiscovery(base)
        if (err != null) {
            notify(project, err, NotificationType.WARNING)
        } else {
            notify(project, "Updated chat.mcp.discovery.enabled in .vscode/settings.json", NotificationType.INFORMATION)
        }
    }

    private fun pickIntelligenceRepo(project: Project) {
        val opts = arrayOf(
            "MCP port CLI (Github-Copilot-ToolBox)",
            "Memory bank CLI",
            "Cursor rules → Copilot CLI",
        )
        val idx = ToolboxDialogUi.showChooseDialog(
            project,
            "Open a Toolbox companion repository on GitHub",
            "Claude Code ToolBox",
            Messages.getQuestionIcon(),
            opts,
            opts[0],
        )
        when (idx) {
            0 -> BrowserUtil.browse("https://github.com/amitchorasiya/Github-Copilot-ToolBox")
            1 -> BrowserUtil.browse("https://github.com/amitchorasiya/Github-Copilot-Memory-Bank")
            2 -> BrowserUtil.browse("https://github.com/amitchorasiya/Github-Copilot-Cursor-Rules-Converter")
        }
    }

    private fun migrateCursorSkills(project: Project, base: Path?, bridge: ClaudeHubBridge) {
        val home = Paths.get(System.getProperty("user.home"))
        val opts = arrayOf(
            "Workspace only (.cursor/skills → .agents/skills)",
            "User only (~/.cursor/skills)",
            "Both workspace and user",
        )
        if (base == null) {
            val one = Messages.showYesNoDialog(
                "No workspace folder — migrate user ~/.cursor/skills only?",
                "Migrate skills",
                Messages.getQuestionIcon(),
            )
            if (one != Messages.YES) return
            val mode = pickCopyMove(project) ?: return
            val r = SkillsCursorToAgentsMigration.runForRoot(home, mode)
            notify(project, summary(r), NotificationType.INFORMATION)
            bridge.refreshHub()
            return
        }
        val scopeIdx = ToolboxDialogUi.showChooseDialog(
            project,
            "Migrate .cursor/skills → .agents/skills",
            "Claude Code ToolBox",
            Messages.getQuestionIcon(),
            opts,
            opts[0],
        )
        if (scopeIdx < 0) {
            return
        }
        val mode = pickCopyMove(project) ?: return
        var totalM = 0
        var totalS = 0
        var totalE = 0
        when (scopeIdx) {
            0 -> {
                val r = SkillsCursorToAgentsMigration.runForRoot(base, mode)
                totalM += r.migrated; totalS += r.skipped; totalE += r.errors
            }
            1 -> {
                val r = SkillsCursorToAgentsMigration.runForRoot(home, mode)
                totalM += r.migrated; totalS += r.skipped; totalE += r.errors
            }
            2 -> {
                val r1 = SkillsCursorToAgentsMigration.runForRoot(base, mode)
                val r2 = SkillsCursorToAgentsMigration.runForRoot(home, mode)
                totalM += r1.migrated + r2.migrated
                totalS += r1.skipped + r2.skipped
                totalE += r1.errors + r2.errors
            }
            else -> return
        }
        notify(
            project,
            "Skills migration: migrated $totalM, skipped $totalS, errors $totalE.",
            if (totalE > 0) NotificationType.WARNING else NotificationType.INFORMATION,
        )
        bridge.refreshHub()
    }

    private fun migrateCopilotSkillsToAgents(project: Project, base: Path?, bridge: ClaudeHubBridge) {
        val home = Paths.get(System.getProperty("user.home"))
        val opts = arrayOf(
            "Workspace only (.github/skills → .agents/skills)",
            "User only (~/.copilot/skills → ~/.agents/skills)",
            "Workspace + user",
        )
        if (base == null) {
            val one = Messages.showYesNoDialog(
                project,
                "No workspace folder — migrate user ~/.copilot/skills only?",
                "Migrate Copilot skills",
                Messages.getQuestionIcon(),
            )
            if (one != Messages.YES) return
            val mode = pickCopyMove(project) ?: return
            val r = SkillsCursorToAgentsMigration.runForUserCopilotSkills(home, mode)
            notify(project, summary(r), NotificationType.INFORMATION)
            bridge.refreshHub()
            return
        }
        val scopeIdx = ToolboxDialogUi.showChooseDialog(
            project,
            "Migrate GitHub/Copilot skills → .agents/skills",
            "Claude Code ToolBox",
            Messages.getQuestionIcon(),
            opts,
            opts[0],
        )
        if (scopeIdx < 0) return
        val mode = pickCopyMove(project) ?: return
        var totalM = 0
        var totalS = 0
        var totalE = 0
        when (scopeIdx) {
            0 -> {
                val r = SkillsCursorToAgentsMigration.runForGithubSkillsRoot(base, mode)
                totalM += r.migrated; totalS += r.skipped; totalE += r.errors
            }
            1 -> {
                val r = SkillsCursorToAgentsMigration.runForUserCopilotSkills(home, mode)
                totalM += r.migrated; totalS += r.skipped; totalE += r.errors
            }
            2 -> {
                val r1 = SkillsCursorToAgentsMigration.runForGithubSkillsRoot(base, mode)
                val r2 = SkillsCursorToAgentsMigration.runForUserCopilotSkills(home, mode)
                totalM += r1.migrated + r2.migrated
                totalS += r1.skipped + r2.skipped
                totalE += r1.errors + r2.errors
            }
            else -> return
        }
        notify(
            project,
            "Copilot/GitHub skills → .agents: migrated $totalM, skipped $totalS, errors $totalE.",
            if (totalE > 0) NotificationType.WARNING else NotificationType.INFORMATION,
        )
        bridge.refreshHub()
    }

    private fun pickCopyMove(project: Project): MigrateSkillMode? {
        val copy = Messages.showYesNoDialog(
            project,
            "Use move (delete from source skills folder after copy)? Choose No for copy-only.",
            "Copy or move",
            Messages.getQuestionIcon(),
        )
        return if (copy == Messages.YES) MigrateSkillMode.MOVE else MigrateSkillMode.COPY
    }

    private fun summary(r: ScopeRun): String =
        "${r.skillsSourcePath}: migrated ${r.migrated}, skipped ${r.skipped}, errors ${r.errors}"

    private fun revealIfExists(project: Project, root: Path?, rel: String) {
        if (root == null) return
        val p = root.resolve(rel)
        if (!Files.exists(p)) {
            notify(project, "Path does not exist: $p", NotificationType.INFORMATION)
            return
        }
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(p.toFile()) ?: return
        com.intellij.ide.projectView.ProjectView.getInstance(project).select(null, vf, true)
    }

    private fun createCursorrulesTemplate(project: Project, base: Path?) {
        if (base == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val p = java.nio.file.Paths.get(base.toString(), ".cursorrules")
        val stub = """# Cursor / Copilot shared hints (root rules)

- Keep answers concise.
- Match existing code style.

"""
        if (Files.exists(p)) {
            notify(project, ".cursorrules already exists — opening.", NotificationType.INFORMATION)
        } else {
            Files.writeString(p, stub)
            notify(project, "Created .cursorrules", NotificationType.INFORMATION)
        }
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(p.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }

    private fun vscodeOnlyPanel(project: Project, detail: String) {
        notify(
            project,
            "$detail Full parity: use the VS Code extension for this project, or track IntelliJ progress in the repo README.",
            NotificationType.INFORMATION,
        )
    }

    private fun notify(project: Project, text: String, type: NotificationType) {
        Notifications.Bus.notify(Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type), project)
    }
}
