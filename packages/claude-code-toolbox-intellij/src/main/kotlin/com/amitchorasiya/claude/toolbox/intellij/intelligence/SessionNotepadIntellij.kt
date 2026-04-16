package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.awt.datatransfer.StringSelection
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

private const val NOTEPAD_REL = ".vscode/cloude-code-toolbox-notepad.md"
private const val LEGACY_REL = ".vscode/copilot-kit-notepad.md"

private val DEFAULT_CONTENT = """# Claude Code ToolBox — session notepad

Pin context here for **this session**.

---

"""

/** Mirrors [packages/cloude-code-toolbox/src/commands/sessionNotepad.ts]. */
object SessionNotepadIntellij {

    /** Canonical notepad path, migrating legacy `copilot-kit-notepad.md` if present. Does not create the file. */
    internal fun resolvedNotepadPath(project: Project): Path? {
        val base = project.basePath ?: return null
        val root = Path.of(base)
        val canonical = root.resolve(NOTEPAD_REL)
        if (Files.exists(canonical)) return canonical
        val legacy = root.resolve(LEGACY_REL)
        if (Files.exists(legacy)) {
            Files.createDirectories(canonical.parent)
            Files.copy(legacy, canonical)
            Files.delete(legacy)
        }
        return canonical
    }

    fun open(project: Project) {
        val uri = resolvedNotepadPath(project) ?: return
        ensureFile(uri)
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(uri.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }

    fun copyToClipboard(project: Project) {
        val uri = resolvedNotepadPath(project) ?: return
        ensureFile(uri)
        val text = Files.readString(uri, StandardCharsets.UTF_8)
        CopyPasteManager.getInstance().setContents(StringSelection(text))
    }

    private fun ensureFile(p: Path) {
        Files.createDirectories(p.parent)
        if (!Files.exists(p)) {
            Files.writeString(p, DEFAULT_CONTENT, StandardCharsets.UTF_8)
        }
    }
}
