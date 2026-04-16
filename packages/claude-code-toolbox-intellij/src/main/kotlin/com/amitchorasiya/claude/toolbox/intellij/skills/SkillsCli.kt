package com.amitchorasiya.claude.toolbox.intellij.skills

import com.intellij.execution.ExecutorRegistry
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.executors.DefaultRunExecutor
import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.ui.RunContentDescriptor
import com.intellij.execution.ui.RunContentManager
import com.intellij.openapi.project.Project
import com.intellij.util.EnvironmentUtil
import java.nio.file.Path

/** Runs `npx -y skills add` with output in the Run tool window. */
object SkillsCli {

    fun install(project: Project, source: String, skillId: String, global: Boolean, cwd: Path?): String? {
        if (!global && cwd == null) {
            return "Open a project folder for a project install, or use global install."
        }
        val working = if (global) Path.of(System.getProperty("user.home")) else cwd!!
        val args = mutableListOf(
            "npx", "-y", "skills", "add", source, "--skill", skillId, "-a", "cursor", "-y",
        )
        if (global) args.add("-g")
        return try {
            val cmd = GeneralCommandLine(args)
            cmd.workDirectory = working.toFile()
            cmd.environment.putAll(EnvironmentUtil.getEnvironmentMap())
            val handler = OSProcessHandler(cmd)
            val console = TextConsoleBuilderFactory.getInstance().createBuilder(project).console
            console.attachToProcess(handler)
            val executor = ExecutorRegistry.getInstance().getExecutorById(DefaultRunExecutor.EXECUTOR_ID)
                ?: return "Could not resolve Run executor."
            val descriptor = RunContentDescriptor(console, handler, console.component, "skills add ($skillId)")
            RunContentManager.getInstance(project).showRunContent(executor, descriptor)
            handler.startNotify()
            null
        } catch (e: Exception) {
            e.message
        }
    }
}
