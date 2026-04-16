package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.TextRange

/** Mirrors [packages/cloude-code-toolbox/src/commands/translateContext.ts]. */
object TranslateContextIntellij {

    fun run(project: Project, settings: ToolboxSettings) {
        val ed = FileEditorManager.getInstance(project).selectedTextEditor ?: run {
            Messages.showErrorDialog(
                project,
                "Open an editor and select text (e.g. in a scratch file or chat export).",
                "Claude Code ToolBox",
            )
            return
        }
        val doc = ed.document
        val sel = ed.selectionModel
        val start = sel.selectionStart
        val end = sel.selectionEnd
        if (start >= end) {
            Messages.showInfoMessage(
                project,
                "Select a region containing @-mentions to translate rough Cursor → Copilot forms.",
                "Translate @-mentions",
            )
            return
        }
        var next = TranslateContextMappings.apply(doc.getText(TextRange(start, end)))
        if (settings.getTranslateWrapMultilineInFence() && next.contains("\n")) {
            val lang = ed.virtualFile?.extension?.takeIf { it.isNotBlank() } ?: "text"
            next = "```$lang\n$next\n```"
        }
        WriteCommandAction.runWriteCommandAction(project) {
            doc.replaceString(start, end, next)
        }
        Messages.showInfoMessage(
            project,
            "Applied rough replacements (@codebase→@workspace, @file→#file:, …). Review before sending to Copilot.",
            "Claude Code ToolBox",
        )
    }
}
