package com.amitchorasiya.claude.toolbox.intellij.settings

import com.intellij.openapi.options.SearchableConfigurable
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.fields.ExtendableTextField
import com.intellij.util.ui.FormBuilder
import java.nio.file.Paths
import javax.swing.JComponent
import javax.swing.JPanel

/** IDE settings UI for `.cloude/toolbox-settings.json` (mirrors key VS Code `cloude-code-toolbox.*` keys). */
class ToolboxSettingsConfigurable(private val project: Project) : SearchableConfigurable {

    private val autoScan = JBCheckBox("Auto-scan MCP & skills on workspace open")
    private val thinking = JBCheckBox("Thinking Machine mode (hub flag)")
    private val insiders = JBCheckBox("Resolve user mcp.json under VS Code Insiders paths")
    private val npxTag = ExtendableTextField()
    private val nodeExe = ExtendableTextField()
    private var root: JPanel? = null

    override fun getId(): String = "com.amitchorasiya.cloude.toolbox.settings"

    override fun getDisplayName(): String = "Claude Code ToolBox"

    override fun createComponent(): JComponent {
        if (root == null) {
            val hint = if (project.basePath == null) {
                "Open a project folder to persist .cloude/toolbox-settings.json."
            } else {
                "Stored in .cloude/toolbox-settings.json for this project (mirrors VS Code extension settings used by the hub and CLI parity layer)."
            }
            npxTag.emptyText.text = "latest"
            nodeExe.emptyText.text = "Optional: absolute path to node (bundled MCP/rules/memory-bank CLIs)"
            root = FormBuilder.createFormBuilder()
                .addComponent(JBLabel(hint))
                .addComponent(autoScan)
                .addComponent(thinking)
                .addLabeledComponent("npx package tag (e.g. latest)", npxTag)
                .addComponent(insiders)
                .addLabeledComponent("Embedded bridge Node path", nodeExe)
                .addComponentFillVertically(JPanel(), 0)
                .panel
            reset()
        }
        return root!!
    }

    override fun isModified(): Boolean {
        val s = ToolboxSettings(projectRoot())
        return autoScan.isSelected != s.getAutoScanMcpSkills() ||
            thinking.isSelected != s.getThinkingMachine() ||
            insiders.isSelected != s.getUseInsidersPaths() ||
            npxTag.text.trim() != s.getNpxTag() ||
            nodeExe.text.trim() != s.getEmbeddedBridgeNodeExecutable()
    }

    override fun apply() {
        val s = ToolboxSettings(projectRoot())
        s.setAutoScanMcpSkills(autoScan.isSelected)
        s.setThinkingMachine(thinking.isSelected)
        s.setUseInsidersPaths(insiders.isSelected)
        s.setNpxTag(npxTag.text.trim())
        s.setEmbeddedBridgeNodeExecutable(nodeExe.text.trim())
    }

    override fun reset() {
        val s = ToolboxSettings(projectRoot())
        autoScan.isSelected = s.getAutoScanMcpSkills()
        thinking.isSelected = s.getThinkingMachine()
        insiders.isSelected = s.getUseInsidersPaths()
        npxTag.text = s.getNpxTag()
        nodeExe.text = s.getEmbeddedBridgeNodeExecutable()
    }

    override fun disposeUIResources() {
        root = null
    }

    private fun projectRoot() = project.basePath?.let { Paths.get(it) }
}
