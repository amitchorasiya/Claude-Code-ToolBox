package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import java.awt.datatransfer.StringSelection
import java.nio.file.Path

private const val NOTICE =
    "> **Review before sending to Claude Code** — pasted `#file:` lines are hints only; remove anything sensitive.\n\n"

/** Mirrors [packages/cloude-code-toolbox/src/intelligence/contextPackCore.ts] `buildContextPackMarkdown` (simplified). */
object ContextPackIntellij {

    fun buildAndCopy(project: Project) {
        val base = project.basePath ?: return
        val root = Path.of(base).toAbsolutePath().normalize().toString()
        val name = Path.of(base).fileName.toString()
        val em = FileEditorManager.getInstance(project)
        val files = em.openFiles
        val relPaths = mutableListOf<String>()
        for (vf in files) {
            val p = pathOrNull(vf) ?: continue
            if (p.startsWith(root)) {
                relPaths.add(p.substring(root.length).trimStart('/', '\\'))
            }
        }
        val ed = em.selectedTextEditor
        val sel = ed?.selectionModel?.selectedText?.trim().orEmpty()
        val lang = ed?.let { detectLang(it) } ?: "text"
        val activeRel = ed?.virtualFile?.let { vf ->
            val p = pathOrNull(vf) ?: return@let null
            if (p.startsWith(root)) p.substring(root.length).trimStart('/', '\\') else null
        }
        val md = buildMarkdown(
            workspaceName = name,
            workspaceRoot = root,
            activeRel = activeRel,
            languageId = lang,
            selection = sel,
            openFiles = relPaths.take(14),
        )
        CopyPasteManager.getInstance().setContents(StringSelection(md))
    }

    private fun pathOrNull(vf: VirtualFile): String? =
        try {
            if (!vf.isInLocalFileSystem) null else VfsUtilCore.virtualToIoFile(vf).absolutePath
        } catch (_: Exception) {
            null
        }

    private fun detectLang(ed: Editor): String {
        val f = ed.virtualFile ?: return "text"
        return f.extension ?: "text"
    }

    private fun buildMarkdown(
        workspaceName: String,
        workspaceRoot: String,
        activeRel: String?,
        languageId: String,
        selection: String,
        openFiles: List<String>,
    ): String {
        val lines = mutableListOf<String>()
        lines.add(NOTICE.trimEnd())
        lines.add("")
        lines.add("## Workspace")
        lines.add("- **$workspaceName**")
        lines.add("- Root: `$workspaceRoot`")
        lines.add("")
        if (activeRel != null) {
            lines.add("## Active editor")
            lines.add("- Path: `$activeRel`")
            lines.add("- Language: `$languageId`")
            if (selection.isNotEmpty()) {
                val max = 8000
                val sel = if (selection.length > max) selection.take(max) + "\n\n… (truncated)" else selection
                lines.add("- Selection:")
                lines.add("```text")
                lines.add(sel)
                lines.add("```")
            }
            lines.add("")
        }
        lines.add("## Open tabs")
        if (openFiles.isEmpty()) {
            lines.add("_No workspace-relative file tabs found._")
        } else {
            for (p in openFiles) {
                lines.add("- `$p`")
            }
        }
        lines.add("")
        lines.add("## Suggested file references")
        lines.add("")
        for (p in openFiles) {
            lines.add("#file:$p")
        }
        lines.add("")
        return lines.joinToString("\n")
    }
}
