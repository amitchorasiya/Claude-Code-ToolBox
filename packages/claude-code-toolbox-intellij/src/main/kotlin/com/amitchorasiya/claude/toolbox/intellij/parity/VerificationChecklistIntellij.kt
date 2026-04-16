package com.amitchorasiya.claude.toolbox.intellij.parity

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBCheckBox
import com.intellij.util.ui.FormBuilder
import java.awt.BorderLayout
import javax.swing.Action
import javax.swing.JComponent
import javax.swing.JPanel

private val ITEMS = listOf(
    "Tests: ran or will run before merge",
    "Review: self-reviewed diff / critical paths",
    "Security: no secrets pasted into chat or committed",
    "Docs: user-facing changes noted if needed",
)

/** Mirrors [packages/cloude-code-toolbox/src/commands/verificationCommand.ts]. */
object VerificationChecklistIntellij {

    fun run(project: Project) {
        val dlg = VerificationDialog(project)
        if (!dlg.showAndGet()) return
        val n = dlg.selectedCount()
        if (n == 0) {
            Messages.showInfoMessage(project, "Verification: no items checked.", "Claude Code ToolBox")
        } else {
            Messages.showInfoMessage(project, "Verification: $n item(s) acknowledged.", "Claude Code ToolBox")
        }
    }
}

private class VerificationDialog(project: Project) : DialogWrapper(project) {
    private val checks = ITEMS.map { JBCheckBox(it, false) }

    init {
        title = "Verification checklist (Claude Code ToolBox)"
        setOKButtonText("Done")
        init()
    }

    fun selectedCount(): Int = checks.count { it.isSelected }

    override fun createCenterPanel(): JComponent {
        val form = FormBuilder.createFormBuilder()
        for (c in checks) {
            form.addComponent(c)
        }
        val panel = JPanel(BorderLayout())
        panel.add(form.panel, BorderLayout.NORTH)
        return panel
    }

    override fun createActions(): Array<Action> = arrayOf(okAction, cancelAction)
}
