package com.amitchorasiya.claude.toolbox.intellij.hub

import com.google.gson.JsonObject
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project

/**
 * Connects the JCEF hub to Kotlin so commands like [com.amitchorasiya.cloude.toolbox.intellij.parity.ToolboxParityDispatcher]
 * can push fresh [HubStateService] payloads after file/CLI changes.
 */
@Service(Service.Level.PROJECT)
class ClaudeHubBridge(private val project: Project) {

    @Volatile
    var postEnvelope: ((JsonObject) -> Unit)? = null

    fun refreshHub() {
        val post = postEnvelope ?: return
        HubStateService.postFullState(project, post)
    }
}
