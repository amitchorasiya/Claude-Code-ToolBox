package com.amitchorasiya.claude.toolbox.intellij.hub

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.extensions.PluginId

/**
 * Registers [VsCodeHubCommandAction] for each known hub command id so [HubCommandBridge] can invoke them.
 */
object VsCodeHubCommandRegistry {

    private val pluginId = PluginId.getId("com.amitchorasiya.cloude.code.toolbox")
    private var done = false

    @Synchronized
    fun ensureRegistered() {
        if (done) {
            return
        }
        done = true
        val am = ActionManager.getInstance()
        for (id in VsCodeHubCommandIds.ALL) {
            if (am.getAction(id) != null) {
                continue
            }
            am.registerAction(id, VsCodeHubCommandAction(id), pluginId)
        }
    }
}
