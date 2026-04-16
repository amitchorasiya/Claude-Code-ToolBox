package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.intelligence.SessionNotepadIntellij
import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isRegularFile
import kotlin.streams.toList

/** Mirrors [packages/cloude-code-toolbox/src/commands/memoryBankFromNotepad.ts]. */
object NotepadToMemoryBankIntellij {

    fun run(project: Project) {
        val base = project.basePath ?: run {
            Messages.showErrorDialog(project, "Open a workspace folder first.", "Claude Code ToolBox")
            return
        }
        val root = Path.of(base)
        val notepadPath = SessionNotepadIntellij.resolvedNotepadPath(project)
        if (notepadPath == null || !Files.isRegularFile(notepadPath)) {
            Messages.showErrorDialog(project, "Open or create the session notepad first.", "Claude Code ToolBox")
            return
        }
        val notepadText = try {
            Files.readString(notepadPath, StandardCharsets.UTF_8).trim()
        } catch (_: Exception) {
            Messages.showErrorDialog(project, "Could not read session notepad.", "Claude Code ToolBox")
            return
        }
        if (notepadText.isEmpty()) {
            Messages.showErrorDialog(project, "Session notepad is empty.", "Claude Code ToolBox")
            return
        }
        val candidates = collectMemoryBankMarkdown(root)
        if (candidates.isEmpty()) {
            val init = Messages.showYesNoDialog(
                project,
                "No memory-bank/**/*.md found. Run Init memory bank from the hub or palette first?",
                "Append notepad → memory-bank",
                Messages.getQuestionIcon(),
            )
            if (init == Messages.YES) {
                // User can run init via dispatcher — no direct call here to avoid circular deps
                Messages.showInfoMessage(project, "Use **Tools → Claude Code ToolBox** hub: **Init memory bank** (or command CloudeCodeToolBox.initMemoryBank).", "Claude Code ToolBox")
            }
            return
        }
        val labels = candidates.map { root.relativize(it).toString().replace('\\', '/') }.toTypedArray()
        val idx = ToolboxDialogUi.showChooseDialog(
            project,
            "Pick target markdown file under memory-bank/.",
            "Append session notepad to memory-bank file",
            Messages.getQuestionIcon(),
            labels,
            labels[0],
        )
        if (idx < 0) return
        val target = candidates[idx]
        val existing = try {
            Files.readString(target, StandardCharsets.UTF_8).trimEnd()
        } catch (_: Exception) {
            Messages.showErrorDialog(project, "Could not read target file.", "Claude Code ToolBox")
            return
        }
        val stamp = "\n\n---\n\n## From session notepad — ${java.time.Instant.now()}\n\n"
        val proposed = "$existing$stamp$notepadText\n"
        ParityScratchFiles.openUnderClaude(project, "append-notepad-preview.md", proposed)
        val apply = Messages.showYesNoDialog(
            project,
            "Apply append to disk on ${target.fileName}?",
            "Confirm append",
            Messages.getWarningIcon(),
        )
        if (apply != Messages.YES) return
        Files.writeString(target, proposed, StandardCharsets.UTF_8)
        Messages.showInfoMessage(project, "Appended notepad to ${root.relativize(target)}.", "Claude Code ToolBox")
    }

    private fun collectMemoryBankMarkdown(root: Path): List<Path> {
        val mb = root.resolve("memory-bank")
        if (!Files.isDirectory(mb)) return emptyList()
        return Files.walk(mb).use { stream ->
            stream.filter { it.isRegularFile() && it.fileName.toString().endsWith(".md") }
                .sorted()
                .toList()
        }
    }
}
