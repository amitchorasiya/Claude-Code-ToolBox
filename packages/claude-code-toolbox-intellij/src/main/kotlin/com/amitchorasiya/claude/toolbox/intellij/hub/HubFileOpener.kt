package com.amitchorasiya.claude.toolbox.intellij.hub

import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.Path as pathOf

/** Opens JSON/config paths used by VS Code commands so hub `runCommand` can do useful work in IntelliJ. */
object HubFileOpener {

    fun openWorkspaceMcp(project: Project) {
        val base = project.basePath ?: run {
            notify(project, "Open a project folder first.", NotificationType.WARNING)
            return
        }
        val p = McpPaths.workspaceMcpJson(pathOf(base))
        ensureMcpJson(p)
        openVfs(project, p)
    }

    fun openUserMcp(project: Project) {
        val base = project.basePath?.let { pathOf(it) }
        val p = ToolboxSettings(base).userMcpJsonPath()
        ensureMcpJson(p)
        openVfs(project, p)
    }

    fun openClaudeUserSettings(project: Project) {
        val home = pathOf(System.getProperty("user.home"))
        val p = home.resolve(".claude").resolve("settings.json")
        if (!Files.exists(p.parent)) {
            try {
                Files.createDirectories(p.parent)
            } catch (_: Exception) {
            }
        }
        if (!Files.exists(p)) {
            try {
                Files.writeString(p, "{}\n", StandardCharsets.UTF_8)
            } catch (_: Exception) {
                notify(project, "Could not create ${p.toAbsolutePath()}", NotificationType.WARNING)
                return
            }
        }
        openVfs(project, p)
    }

    private fun ensureMcpJson(path: Path) {
        if (!Files.exists(path.parent)) {
            try {
                Files.createDirectories(path.parent)
            } catch (_: Exception) {
            }
        }
        if (!Files.exists(path)) {
            try {
                Files.writeString(path, "{\n  \"servers\": {}\n}\n", StandardCharsets.UTF_8)
            } catch (_: Exception) {
            }
        }
    }

    private fun openVfs(project: Project, path: Path) {
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(path.toFile()) ?: run {
            notify(project, "Could not open: $path", NotificationType.WARNING)
            return
        }
        FileEditorManager.getInstance(project).openFile(vf, true)
    }

    private fun notify(project: Project, text: String, type: NotificationType) {
        Notifications.Bus.notify(
            Notification("CloudeCodeToolBox", "Claude Code ToolBox", text, type),
            project,
        )
    }
}
