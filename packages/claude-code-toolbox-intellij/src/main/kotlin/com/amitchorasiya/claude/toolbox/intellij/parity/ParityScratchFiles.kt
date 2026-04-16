package com.amitchorasiya.claude.toolbox.intellij.parity

import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

/** Writes under `.claude/` and opens in the editor (avoids LightVirtualFile API differences across platform builds). */
internal object ParityScratchFiles {

    fun openUnderClaude(project: Project, fileName: String, content: String) {
        val base = project.basePath ?: return
        val p = Path.of(base).resolve(".claude").resolve(fileName)
        Files.createDirectories(p.parent)
        Files.writeString(p, content, StandardCharsets.UTF_8)
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(p.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }
}
