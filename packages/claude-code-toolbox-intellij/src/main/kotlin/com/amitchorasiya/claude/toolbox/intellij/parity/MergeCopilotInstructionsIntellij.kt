package com.amitchorasiya.claude.toolbox.intellij.parity

import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

/** Mirrors [packages/cloude-code-toolbox/src/commands/mergeCopilotInstructionsIntoClaudeMd.ts]. */
object MergeCopilotInstructionsIntellij {

    /** Like [run] but no editor focus or notification; returns whether content was merged. */
    fun mergeSilent(project: Project): Boolean {
        val base = project.basePath ?: return false
        val root = Path.of(base)
        val copilot = root.resolve(".github").resolve("copilot-instructions.md")
        if (!Files.isRegularFile(copilot)) return false
        val copilotText = try {
            Files.readString(copilot, StandardCharsets.UTF_8).trim()
        } catch (_: Exception) {
            return false
        }
        if (copilotText.isEmpty()) return false
        val claude = root.resolve("CLAUDE.md")
        val existing = if (Files.isRegularFile(claude)) {
            Files.readString(claude, StandardCharsets.UTF_8)
        } else {
            ""
        }
        val next = CopilotInstructionsMerge.mergeIntoClaudeMd(existing, copilotText)
        Files.writeString(claude, next, StandardCharsets.UTF_8)
        return true
    }

    fun run(project: Project) {
        val base = project.basePath ?: return
        val root = Path.of(base)
        val copilot = root.resolve(".github").resolve("copilot-instructions.md")
        if (!Files.isRegularFile(copilot)) {
            notify(project, "Nothing merged: .github/copilot-instructions.md is missing.", com.intellij.notification.NotificationType.INFORMATION)
            return
        }
        val copilotText = try {
            Files.readString(copilot, StandardCharsets.UTF_8).trim()
        } catch (_: Exception) {
            notify(project, "Could not read .github/copilot-instructions.md.", com.intellij.notification.NotificationType.WARNING)
            return
        }
        if (copilotText.isEmpty()) {
            notify(project, "Nothing merged: .github/copilot-instructions.md is empty.", com.intellij.notification.NotificationType.INFORMATION)
            return
        }
        val claude = root.resolve("CLAUDE.md")
        val existing = if (Files.isRegularFile(claude)) {
            Files.readString(claude, StandardCharsets.UTF_8)
        } else {
            ""
        }
        val next = CopilotInstructionsMerge.mergeIntoClaudeMd(existing, copilotText)
        Files.writeString(claude, next, StandardCharsets.UTF_8)
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(claude.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
        notify(project, "Merged .github/copilot-instructions.md into CLAUDE.md.", com.intellij.notification.NotificationType.INFORMATION)
    }

    private fun notify(project: Project, text: String, type: com.intellij.notification.NotificationType) {
        com.intellij.notification.Notifications.Bus.notify(
            com.intellij.notification.Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type),
            project,
        )
    }
}
