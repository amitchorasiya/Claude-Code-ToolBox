package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBScrollPane
import java.awt.Dimension
import javax.swing.Action
import javax.swing.JComponent
import javax.swing.JEditorPane
import javax.swing.ScrollPaneConstants

/** Lightweight parity panel for **Composer tips hub** (VS Code webview → IDE dialog). */
object ComposerHubIntellij {
    fun show(project: Project) {
        ComposerHubDialog(project).show()
    }
}

private class ComposerHubDialog(project: Project) : DialogWrapper(project) {
    init {
        title = "Composer tips hub"
        setOKButtonText("Close")
        init()
    }

    override fun createCenterPanel(): JComponent {
        val pane = JEditorPane().apply {
            contentType = "text/html"
            isEditable = false
            text = """
                <html><body style="font-family: sans-serif; font-size: 13px;">
                <h2>Composer / chat</h2>
                <p>In VS Code this opens a dedicated webview. In IntelliJ, use the <b>Claude Code ToolBox</b> tool window hub for the same flows.</p>
                <ul>
                  <li><b>Session notepad</b> — <code>.vscode/cloude-code-toolbox-notepad.md</code></li>
                  <li><b>Build context pack</b> — copies workspace tab hints to the clipboard</li>
                  <li><b>MCP &amp; Skills awareness</b> — report under <code>.claude/</code></li>
                </ul>
                </body></html>
            """.trimIndent()
        }
        val scroll = JBScrollPane(
            pane,
            ScrollPaneConstants.VERTICAL_SCROLLBAR_AS_NEEDED,
            ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER,
        )
        scroll.preferredSize = Dimension(520, 380)
        return scroll
    }

    override fun createActions(): Array<Action> = arrayOf(okAction)
}
