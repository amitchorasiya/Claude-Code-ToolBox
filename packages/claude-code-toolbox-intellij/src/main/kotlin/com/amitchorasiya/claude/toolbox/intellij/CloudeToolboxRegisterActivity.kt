package com.amitchorasiya.claude.toolbox.intellij

import com.amitchorasiya.claude.toolbox.intellij.hub.VsCodeHubCommandRegistry
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

/** Registers VS Code–shaped command ids once; first project open triggers registration. */
class CloudeToolboxRegisterActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        VsCodeHubCommandRegistry.ensureRegistered()
    }
}
