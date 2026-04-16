package com.amitchorasiya.claude.toolbox.intellij.parity

import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

/** Mirrors [packages/cloude-code-toolbox/src/commands/migrateCursorrules.ts]. */
object AppendCursorrulesIntellij {

    /** Merge without UI; returns false if `.cursorrules` missing or empty. */
    fun mergeSilent(project: Project): Boolean {
        val base = project.basePath ?: return false
        val root = Path.of(base)
        val rulesPath = root.resolve(".cursorrules")
        if (!Files.isRegularFile(rulesPath)) return false
        val rulesText = try {
            Files.readString(rulesPath, StandardCharsets.UTF_8).trim()
        } catch (_: Exception) {
            return false
        }
        if (rulesText.isEmpty()) return false
        val claude = root.resolve("CLAUDE.md")
        val existing = if (Files.isRegularFile(claude)) {
            Files.readString(claude, StandardCharsets.UTF_8)
        } else {
            ""
        }
        val next = AppendCursorrulesMerge.mergeIntoClaudeMd(existing, rulesText)
        Files.writeString(claude, next, StandardCharsets.UTF_8)
        return true
    }

    fun run(project: Project) {
        val base = project.basePath ?: return
        val root = Path.of(base)
        val rulesPath = root.resolve(".cursorrules")
        if (!Files.isRegularFile(rulesPath)) {
            notify(project, "No .cursorrules file found at workspace root.", com.intellij.notification.NotificationType.WARNING)
            return
        }
        val rulesText = try {
            Files.readString(rulesPath, StandardCharsets.UTF_8).trim()
        } catch (_: Exception) {
            notify(project, "Could not read .cursorrules.", com.intellij.notification.NotificationType.WARNING)
            return
        }
        if (rulesText.isEmpty()) {
            notify(project, ".cursorrules is empty.", com.intellij.notification.NotificationType.WARNING)
            return
        }
        val claude = root.resolve("CLAUDE.md")
        val existing = if (Files.isRegularFile(claude)) {
            Files.readString(claude, StandardCharsets.UTF_8)
        } else {
            ""
        }
        val next = AppendCursorrulesMerge.mergeIntoClaudeMd(existing, rulesText)
        Files.writeString(claude, next, StandardCharsets.UTF_8)
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(claude.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
        notify(project, "Merged .cursorrules into CLAUDE.md (replaceable block).", com.intellij.notification.NotificationType.INFORMATION)
    }

    private fun notify(project: Project, text: String, type: com.intellij.notification.NotificationType) {
        com.intellij.notification.Notifications.Bus.notify(
            com.intellij.notification.Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type),
            project,
        )
    }
}
