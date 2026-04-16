package com.amitchorasiya.claude.toolbox.intellij.wizard

import com.amitchorasiya.claude.toolbox.intellij.settings.OneClickSetupModel
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.DialogWrapper.DialogWrapperAction
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.CardLayout
import java.awt.Dimension
import java.awt.event.ActionEvent
import javax.swing.Action
import javax.swing.JComboBox
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTextArea
import java.nio.file.Paths

/**
 * Stepped wizard for **One Click Setup** (parity with VS Code confirmation + settings-driven run).
 */
class OneClickSetupWizardDialog(private val project: Project) : DialogWrapper(project) {

    private val settings = ToolboxSettings(project.basePath?.let { Paths.get(it) })
    private var model: OneClickSetupModel = settings.getOneClickSetup()

    private val cards = JPanel(CardLayout())
    private var step = 0
    private val lastStepIndex = 5

    private val acknowledge = JBCheckBox("I understand — run setup (review terminals and file changes).")

    private val migrateFromCursor = JBCheckBox("Cursor → Claude Code track")
    private val migrateFromGitHubCopilot = JBCheckBox("GitHub Copilot → Claude Code track")

    private val migrateSkillsTarget = comboOf("off", "workspace", "user", "both")
    private val migrateSkillsMode = comboOf("copy", "move")
    private val syncCursorRulesMode = comboOf("apply", "dryRun", "off")
    private val appendCursorrules = JBCheckBox("Append .cursorrules into CLAUDE.md (if file exists)")
    private val portCursorMcp = comboOf("user", "workspaceMerge", "dry", "skip")

    private val mergeCopilotMd = JBCheckBox("Merge .github/copilot-instructions.md → CLAUDE.md")
    private val migrateCopilotSkillsTarget = comboOf("off", "workspace", "user", "both")
    private val migrateCopilotSkillsMode = comboOf("copy", "move")
    private val copilotMcpReminder = JBCheckBox("After setup: remind about VS Code mcp.json vs Claude /mcp")

    private val initMemoryBankMode = comboOf("apply", "dryRun", "off")
    private val initMemoryBankCursorRules = JBCheckBox("Memory bank: pass --cursor-rules when Cursor track is on")

    private val instructionMergeAfterOneClick =
        comboOf("enableAutoScan", "mergeClaudeMdOnce", "leaveUnchanged")

    private val runAwarenessScan = JBCheckBox("Run MCP & Skills awareness scan (writes .claude/)")
    private val runReadiness = JBCheckBox("Open readiness report")
    private val runConfigScan = JBCheckBox("Run MCP / instruction config scan")
    private val runFirstTestTask = JBCheckBox("Run first test task (Gradle or npm)")

    private val summaryArea = JTextArea().apply {
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
        border = JBUI.Borders.empty(8)
    }

    private lateinit var previousAction: Action

    init {
        title = "One Click Setup"
        migrateFromCursor.toolTipText = "Skills, rules sync, .cursorrules append, Cursor MCP port"
        migrateFromGitHubCopilot.toolTipText = "Copilot instructions merge, .github/skills migration"
        init()
    }

    override fun createCenterPanel(): JComponent {
        loadUiFromModel()
        cards.add(stepIntro(), "0")
        cards.add(stepTracks(), "1")
        cards.add(stepCursor(), "2")
        cards.add(stepCopilotShared(), "3")
        cards.add(stepFollowUps(), "4")
        cards.add(stepSummary(), "5")
        val wrap = JPanel(BorderLayout())
        wrap.add(cards, BorderLayout.CENTER)
        showStep()
        return wrap
    }

    override fun createActions(): Array<Action> {
        previousAction = object : DialogWrapperAction("Back") {
            override fun doAction(e: ActionEvent) {
                if (step > 0) {
                    step--
                    showStep()
                }
            }
        }
        previousAction.isEnabled = false
        return arrayOf(cancelAction, previousAction, okAction)
    }

    override fun doOKAction() {
        if (!validateCurrentStep()) {
            return
        }
        if (step < lastStepIndex) {
            step++
            if (step == lastStepIndex) {
                applyUiToModel()
                refreshSummary()
            }
            showStep()
            return
        }
        applyUiToModel()
        OneClickSetupRunner.run(project, model)
        super.doOKAction()
    }

    private fun showStep() {
        (cards.layout as CardLayout).show(cards, step.toString())
        setOKButtonText(if (step == lastStepIndex) "Run setup" else "Next")
        // createCenterPanel() runs before createActions(); Back action is not ready yet on first showStep().
        if (::previousAction.isInitialized) {
            previousAction.isEnabled = step > 0
        }
    }

    private fun validateCurrentStep(): Boolean {
        if (step == 0 && !acknowledge.isSelected) {
            Messages.showWarningDialog(
                project,
                "Confirm that you understand you are responsible for reviewing all changes.",
                "One Click Setup",
            )
            return false
        }
        return true
    }

    private fun loadUiFromModel() {
        val m = model
        migrateFromCursor.isSelected = m.migrateFromCursor
        migrateFromGitHubCopilot.isSelected = m.migrateFromGitHubCopilot
        migrateSkillsTarget.selectedItem = m.migrateSkillsTarget
        migrateSkillsMode.selectedItem = m.migrateSkillsMode
        syncCursorRulesMode.selectedItem = m.syncCursorRulesMode
        appendCursorrules.isSelected = m.appendCursorrules
        portCursorMcp.selectedItem = m.portCursorMcp
        mergeCopilotMd.isSelected = m.mergeCopilotInstructionsIntoClaudeMd
        migrateCopilotSkillsTarget.selectedItem = m.migrateCopilotSkillsTarget
        migrateCopilotSkillsMode.selectedItem = m.migrateCopilotSkillsMode
        copilotMcpReminder.isSelected = m.copilotMcpReminderAfterOneClick
        initMemoryBankMode.selectedItem = m.initMemoryBankMode
        initMemoryBankCursorRules.isSelected = m.initMemoryBankCursorRules
        instructionMergeAfterOneClick.selectedItem = m.instructionMergeAfterOneClick
        runAwarenessScan.isSelected = m.runAwarenessScan
        runReadiness.isSelected = m.runReadiness
        runConfigScan.isSelected = m.runConfigScan
        runFirstTestTask.isSelected = m.runFirstTestTask
    }

    private fun applyUiToModel() {
        model = OneClickSetupModel(
            migrateFromCursor = migrateFromCursor.isSelected,
            migrateFromGitHubCopilot = migrateFromGitHubCopilot.isSelected,
            migrateSkillsTarget = migrateSkillsTarget.selectedItem as String,
            migrateSkillsMode = migrateSkillsMode.selectedItem as String,
            syncCursorRulesMode = syncCursorRulesMode.selectedItem as String,
            appendCursorrules = appendCursorrules.isSelected,
            portCursorMcp = portCursorMcp.selectedItem as String,
            mergeCopilotInstructionsIntoClaudeMd = mergeCopilotMd.isSelected,
            migrateCopilotSkillsTarget = migrateCopilotSkillsTarget.selectedItem as String,
            migrateCopilotSkillsMode = migrateCopilotSkillsMode.selectedItem as String,
            copilotMcpReminderAfterOneClick = copilotMcpReminder.isSelected,
            initMemoryBankMode = initMemoryBankMode.selectedItem as String,
            initMemoryBankCursorRules = initMemoryBankCursorRules.isSelected,
            instructionMergeAfterOneClick = instructionMergeAfterOneClick.selectedItem as String,
            runAwarenessScan = runAwarenessScan.isSelected,
            runReadiness = runReadiness.isSelected,
            runConfigScan = runConfigScan.isSelected,
            runFirstTestTask = runFirstTestTask.isSelected,
        )
    }

    private fun refreshSummary() {
        val lines = mutableListOf<String>()
        lines.add("Review — One Click Setup will:")
        lines.add("")
        if (model.migrateFromCursor) {
            lines.add("• Cursor track: skills=${model.migrateSkillsTarget}, rules=${model.syncCursorRulesMode}, MCP port=${model.portCursorMcp}")
        } else {
            lines.add("• Cursor track: off")
        }
        if (model.migrateFromGitHubCopilot) {
            lines.add("• Copilot track: merge instructions=${model.mergeCopilotInstructionsIntoClaudeMd}, skills=${model.migrateCopilotSkillsTarget}")
        } else {
            lines.add("• Copilot track: off")
        }
        lines.add("• Memory bank: ${model.initMemoryBankMode}")
        lines.add("• After bridges: ${model.instructionMergeAfterOneClick}")
        lines.add("• Follow-ups: awareness=${model.runAwarenessScan}, readiness=${model.runReadiness}, scan=${model.runConfigScan}, test=${model.runFirstTestTask}")
        lines.add("")
        lines.add("Settings will be saved to .cloude/toolbox-settings.json when you run.")
        summaryArea.text = lines.joinToString("\n")
    }

    private fun stepIntro(): JComponent {
        val html = JBLabel(
            "<html><body style=\"width:420px;\">" +
                "<b>One Click Setup</b> runs npx bridge CLIs in the Run tool window, merges instruction files, " +
                "and opens scans — matching the VS Code extension flow.<br>" +
                "Merge-only policy: existing files are not replaced wholesale; toolbox-managed sections are updated and missing entries are added.<br><br>" +
                "Adjust steps on the following screens. Defaults come from your saved toolbox settings.</body></html>",
        )
        return FormBuilder.createFormBuilder()
            .addComponent(html)
            .addComponent(acknowledge)
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    private fun stepTracks(): JComponent = FormBuilder.createFormBuilder()
        .addComponent(JBLabel("Choose which migration tracks to run:"))
        .addComponent(migrateFromCursor)
        .addComponent(migrateFromGitHubCopilot)
        .addComponentFillVertically(JPanel(), 0)
        .panel

    private fun stepCursor(): JComponent = FormBuilder.createFormBuilder()
        .addComponent(JBLabel("Cursor → Claude Code (only if that track is enabled on the previous step):"))
        .addLabeledComponent("Migrate .cursor/skills → .agents/skills", migrateSkillsTarget)
        .addLabeledComponent("Skills copy vs move", migrateSkillsMode)
        .addLabeledComponent("Sync Cursor rules → CLAUDE.md", syncCursorRulesMode)
        .addComponent(appendCursorrules)
        .addLabeledComponent("Port Cursor MCP → mcp.json", portCursorMcp)
        .addComponentFillVertically(JPanel(), 0)
        .panel

    private fun stepCopilotShared(): JComponent = FormBuilder.createFormBuilder()
        .addComponent(JBLabel("Copilot track + memory bank:"))
        .addComponent(mergeCopilotMd)
        .addLabeledComponent("Migrate Copilot/GitHub skills", migrateCopilotSkillsTarget)
        .addLabeledComponent("Copilot skills mode", migrateCopilotSkillsMode)
        .addComponent(copilotMcpReminder)
        .addSeparator()
        .addLabeledComponent("Memory bank init", initMemoryBankMode)
        .addComponent(initMemoryBankCursorRules)
        .addLabeledComponent("After bridges: auto-scan / merge policy", instructionMergeAfterOneClick)
        .addComponentFillVertically(JPanel(), 0)
        .panel

    private fun stepFollowUps(): JComponent = FormBuilder.createFormBuilder()
        .addComponent(JBLabel("Follow-up actions after bridges:"))
        .addComponent(runAwarenessScan)
        .addComponent(runReadiness)
        .addComponent(runConfigScan)
        .addComponent(runFirstTestTask)
        .addComponentFillVertically(JPanel(), 0)
        .panel

    private fun stepSummary(): JComponent {
        val scroll = JBScrollPane(summaryArea)
        scroll.preferredSize = Dimension(480, 220)
        return FormBuilder.createFormBuilder()
            .addComponent(JBLabel("Summary"))
            .addComponent(scroll)
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    private fun comboOf(vararg items: String): JComboBox<String> {
        val c = JComboBox(items)
        c.maximumSize = Dimension(Int.MAX_VALUE, c.preferredSize.height)
        return c
    }
}
