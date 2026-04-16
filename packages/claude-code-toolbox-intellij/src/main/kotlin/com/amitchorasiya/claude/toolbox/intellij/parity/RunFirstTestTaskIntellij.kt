package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.cli.ToolboxNodeRunner
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path

/** Mirrors [packages/cloude-code-toolbox/src/commands/runFirstTestTask.ts] heuristics (Gradle / npm). */
object RunFirstTestTaskIntellij {

    fun run(project: Project, base: Path?) {
        if (base == null) {
            notify(project, "Open a workspace folder first.", NotificationType.WARNING)
            return
        }
        val win = System.getProperty("os.name").lowercase().contains("win")
        val gradlew = if (win) base.resolve("gradlew.bat") else base.resolve("gradlew")
        if (Files.isRegularFile(gradlew)) {
            val argv = if (win) {
                listOf(gradlew.toAbsolutePath().toString(), "test")
            } else {
                listOf("./gradlew", "test")
            }
            ToolboxNodeRunner.runRaw(project, base, argv, "Gradle test")
            notify(project, "Started Gradle test task.", NotificationType.INFORMATION)
            return
        }
        val pkg = base.resolve("package.json")
        if (Files.isRegularFile(pkg)) {
            ToolboxNodeRunner.runRaw(project, base, listOf("npm", "test"), "npm test")
            notify(project, "Started npm test.", NotificationType.INFORMATION)
            return
        }
        notify(
            project,
            "No gradlew or package.json found — create a Run configuration or add npm scripts, then run tests from the IDE.",
            NotificationType.WARNING,
        )
    }

    private fun notify(project: Project, text: String, type: NotificationType) {
        Notifications.Bus.notify(Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type), project)
    }
}
