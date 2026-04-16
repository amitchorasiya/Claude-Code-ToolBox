package com.amitchorasiya.claude.toolbox.intellij.skills

import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.Path
import kotlin.io.path.isDirectory

/**
 * Deletes a skill folder only if it sits under the same roots as [LocalSkillsScanner] (mirrors VS Code `deleteSkillFolderFromHub`).
 */
object SkillFolderDelete {

    private val USER_ROOTS = listOf(
        listOf(".copilot", "skills"),
        listOf(".claude", "skills"),
        listOf(".agents", "skills"),
        listOf(".cursor", "skills"),
    )
    private val WS_ROOTS = listOf(
        listOf(".github", "skills"),
        listOf(".claude", "skills"),
        listOf(".agents", "skills"),
        listOf(".cursor", "skills"),
    )

    fun deleteIfAllowed(project: Project, projectRoot: Path?, scope: String, rootPath: String, hub: SkillHubState): String? {
        val normalized = try {
            Path(rootPath).normalize()
        } catch (_: Exception) {
            return "Invalid path."
        }
        val home = Path(System.getProperty("user.home")).normalize()
        val allowed = when (scope) {
            "workspace" -> {
                val base = projectRoot?.normalize() ?: return "Open a project folder for workspace skills."
                isUnderSkillRoot(normalized, base, WS_ROOTS)
            }
            else -> isUnderSkillRoot(normalized, home, USER_ROOTS)
        }
        if (!allowed) {
            return "Refusing to delete: folder is not under a known skill root (.github/skills, .agents/skills, etc.)."
        }
        if (!ToolboxDialogUi.confirmOkCancel(
                project,
                "Claude Code ToolBox",
                "Move this skill folder to trash (or delete)?\n$rootPath",
                Messages.getWarningIcon(),
            )
        ) {
            return "cancelled"
        }
        return try {
            deleteRecursive(normalized)
            val abs = normalized.toAbsolutePath().normalize().toString()
            val skillId = "$scope:$abs"
            hub.setDisabled(skillId, false)
            null
        } catch (e: Exception) {
            e.message ?: "Delete failed"
        }
    }

    private fun isUnderSkillRoot(skillRoot: Path, baseRoot: Path, segmentsList: List<List<String>>): Boolean {
        for (segs in segmentsList) {
            var p = baseRoot
            for (s in segs) {
                p = p.resolve(s)
            }
            val base = p.normalize()
            if (!base.isDirectory()) continue
            val skillStr = skillRoot.toString()
            val baseStr = base.toString()
            if (skillStr.startsWith(baseStr + java.io.File.separator) && skillStr != baseStr) {
                return true
            }
        }
        return false
    }

    private fun deleteRecursive(root: Path) {
        if (Files.isDirectory(root)) {
            Files.walk(root).use { stream ->
                stream.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) }
            }
        } else {
            Files.deleteIfExists(root)
        }
    }
}
