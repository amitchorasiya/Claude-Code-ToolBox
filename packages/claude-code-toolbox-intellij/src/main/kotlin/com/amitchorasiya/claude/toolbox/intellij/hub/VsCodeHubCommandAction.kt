package com.amitchorasiya.claude.toolbox.intellij.hub

import com.amitchorasiya.claude.toolbox.intellij.parity.ToolboxParityDispatcher
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

/**
 * One action instance per VS Code `CloudeCodeToolBox.*` command id. Registered at startup so hub `runCommand` resolves.
 */
class VsCodeHubCommandAction(private val commandId: String) : AnAction(
    commandId.removePrefix("CloudeCodeToolBox."),
    "Claude Code ToolBox",
    null,
) {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        ToolboxParityDispatcher.dispatch(project, commandId)
    }
}
