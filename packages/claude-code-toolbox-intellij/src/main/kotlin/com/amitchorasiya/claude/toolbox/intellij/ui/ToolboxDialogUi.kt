package com.amitchorasiya.claude.toolbox.intellij.ui

import com.intellij.CommonBundle
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.MessageDialogBuilder
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import javax.swing.Icon
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.ListSelectionModel

/**
 * Non-deprecated dialog helpers (replaces [Messages.showChooseDialog] / icon-only ok-cancel overloads
 * flagged by the Plugin Verifier).
 */
object ToolboxDialogUi {

    fun showChooseDialog(
        project: Project,
        message: String,
        title: String,
        icon: Icon?,
        options: Array<String>,
        initial: String,
    ): Int {
        val dlg = StringListChooseDialog(project, message, title, options, initial, icon)
        if (!dlg.showAndGet()) {
            return -1
        }
        return dlg.selectedIndex()
    }

    fun confirmOkCancel(project: Project, title: String, message: String, icon: Icon): Boolean =
        MessageDialogBuilder.okCancel(title, message)
            .yesText(CommonBundle.getOkButtonText())
            .noText(CommonBundle.getCancelButtonText())
            .icon(icon)
            .ask(project)
}

private class StringListChooseDialog(
    project: Project,
    private val message: String,
    dialogTitle: String,
    private val options: Array<String>,
    initial: String,
    private val icon: Icon?,
) : DialogWrapper(project) {

    private val list = JBList(*options)

    init {
        title = dialogTitle
        list.selectionMode = ListSelectionModel.SINGLE_SELECTION
        val start = options.indexOf(initial).let { if (it >= 0) it else 0 }
        list.selectedIndex = start
        init()
    }

    override fun getPreferredFocusedComponent() = list

    override fun createCenterPanel(): JPanel {
        val panel = JPanel(BorderLayout())
        val header = JPanel(BorderLayout())
        if (icon != null) {
            header.add(JLabel(icon), BorderLayout.WEST)
        }
        if (message.isNotBlank()) {
            val label = JLabel("<html>${message.replace("\n", "<br/>")}</html>")
            label.border = JBUI.Borders.empty(0, if (icon != null) 8 else 0, 8, 0)
            header.add(label, BorderLayout.CENTER)
        }
        if (icon != null || message.isNotBlank()) {
            panel.add(header, BorderLayout.NORTH)
        }
        val scroll = JBScrollPane(list)
        scroll.preferredSize = JBUI.size(520, 220)
        panel.add(scroll, BorderLayout.CENTER)
        return panel
    }

    fun selectedIndex(): Int = list.selectedIndex
}
