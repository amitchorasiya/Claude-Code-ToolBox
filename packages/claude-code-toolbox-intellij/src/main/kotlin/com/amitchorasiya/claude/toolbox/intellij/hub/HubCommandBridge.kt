package com.amitchorasiya.claude.toolbox.intellij.hub

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.WindowManager

/**
 * Tries to run an IntelliJ action by ID (only if registered). VS Code `CloudeCodeToolBox.*` IDs are not registered by default.
 */
object HubCommandBridge {

    fun tryExecute(project: Project, actionId: String): Boolean {
        val action = ActionManager.getInstance().getAction(actionId) ?: return false
        val frame = WindowManager.getInstance().getFrame(project) ?: return false
        val callback = ActionManager.getInstance().tryToExecute(
            action,
            null,
            frame,
            ActionPlaces.UNKNOWN,
            true,
        )
        return !callback.isRejected
    }
}
