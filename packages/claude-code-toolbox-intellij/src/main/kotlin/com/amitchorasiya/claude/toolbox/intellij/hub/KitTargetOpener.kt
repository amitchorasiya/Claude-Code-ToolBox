package com.amitchorasiya.claude.toolbox.intellij.hub

import com.intellij.ide.actions.RevealFileAction
import com.intellij.ide.projectView.ProjectView
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File

/** Hub kit row “Open” — same idea as VS Code `openKitTarget`. */
object KitTargetOpener {

    fun open(project: Project, fsPath: String, isDirectory: Boolean) {
        val vf = LocalFileSystem.getInstance().findFileByIoFile(File(fsPath)) ?: return
        if (isDirectory) {
            ProjectView.getInstance(project).select(null, vf, true)
        } else {
            FileEditorManager.getInstance(project).openFile(vf, true)
        }
    }

    fun reveal(project: Project, fsPath: String) {
        val vf = LocalFileSystem.getInstance().findFileByIoFile(File(fsPath)) ?: return
        if (vf.isDirectory) {
            ProjectView.getInstance(project).select(null, vf, true)
        } else {
            RevealFileAction.openFile(File(fsPath))
        }
    }
}
