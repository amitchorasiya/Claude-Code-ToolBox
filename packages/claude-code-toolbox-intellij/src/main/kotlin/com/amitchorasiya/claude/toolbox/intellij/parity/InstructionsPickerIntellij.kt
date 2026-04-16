package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile

/** Mirrors [packages/cloude-code-toolbox/src/commands/openInstructionsPicker.ts]. */
object InstructionsPickerIntellij {

    fun open(project: Project) {
        val base = project.basePath ?: run {
            Messages.showErrorDialog(project, "Open a workspace folder first.", "Claude Code ToolBox")
            return
        }
        val root = Path.of(base)
        val candidates = mutableListOf<Pair<String, Path>>()
        candidates.add("CLAUDE.md" to root.resolve("CLAUDE.md"))
        candidates.add("AGENTS.md" to root.resolve("AGENTS.md"))
        candidates.add(".cursorrules" to root.resolve(".cursorrules"))
        val claudeRules = root.resolve(".claude").resolve("rules")
        if (claudeRules.isDirectory()) {
            Files.list(claudeRules).use { stream ->
                stream.filter { it.isRegularFile() && it.fileName.toString().endsWith(".md") }
                    .sorted()
                    .forEach { candidates.add(".claude/rules/${it.fileName}" to it) }
            }
        }
        val cursorRules = root.resolve(".cursor").resolve("rules")
        if (cursorRules.isDirectory()) {
            Files.list(cursorRules).use { stream ->
                stream.filter {
                    it.isRegularFile() && (it.fileName.toString().endsWith(".mdc") || it.fileName.toString().endsWith(".md"))
                }.sorted().forEach { candidates.add(".cursor/rules/${it.fileName}" to it) }
            }
        }
        val existing = candidates.filter { Files.exists(it.second) }.toTypedArray()
        if (existing.isEmpty()) {
            Messages.showInfoMessage(project, "No instruction files found yet (CLAUDE.md, AGENTS.md, …).", "Claude Code ToolBox")
            return
        }
        val labels = existing.map { it.first }.toTypedArray()
        val idx = ToolboxDialogUi.showChooseDialog(
            project,
            "Pick a file to open.",
            "Open instruction / rules file",
            Messages.getInformationIcon(),
            labels,
            labels[0],
        )
        if (idx < 0) return
        val path = existing[idx].second
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(path.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }
}
