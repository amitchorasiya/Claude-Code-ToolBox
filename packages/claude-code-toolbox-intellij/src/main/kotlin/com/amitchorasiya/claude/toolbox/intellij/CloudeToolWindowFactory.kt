package com.amitchorasiya.claude.toolbox.intellij

import com.amitchorasiya.claude.toolbox.intellij.hub.HubJcefPanel
import com.amitchorasiya.claude.toolbox.intellij.hub.VsCodeHubCommandRegistry
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * Hosts the full hub UI (JCEF) when available; falls back inside [HubJcefPanel] if JCEF is off.
 */
class CloudeToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        VsCodeHubCommandRegistry.ensureRegistered()
        val hub = HubJcefPanel(project)
        Disposer.register(project, hub)
        val content = ContentFactory.getInstance().createContent(hub, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
