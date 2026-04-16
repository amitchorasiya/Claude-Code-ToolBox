package com.amitchorasiya.claude.toolbox.intellij.cli

import com.intellij.execution.ExecutorRegistry
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.executors.DefaultRunExecutor
import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.ui.RunContentDescriptor
import com.intellij.execution.ui.RunContentManager
import com.intellij.openapi.project.Project
import com.intellij.util.EnvironmentUtil
import com.amitchorasiya.claude.toolbox.intellij.settings.ToolboxSettings
import java.nio.file.Path

/**
 * Runs `npx` / arbitrary shell commands with workspace cwd and shows output in the Run tool window
 * (same rough model as VS Code’s “Claude Code ToolBox” terminal).
 */
object ToolboxNodeRunner {

    /**
     * Runs a bridge CLI [BundledBridgeCli] shipped inside the plugin with `node` (or
     * [ToolboxSettings.getEmbeddedBridgeNodeExecutable]), matching VS Code’s bundled CLIs — no npm registry.
     */
    fun runBundledToolboxBridge(
        project: Project,
        cwd: Path,
        cli: BundledBridgeCli,
        args: List<String>,
        runTitle: String,
        settings: ToolboxSettings,
    ): String? {
        val cliPath = BundledBridgeCliRunner.resolveCliPath(cli)
        val node = settings.getEmbeddedBridgeNodeExecutable().trim().ifEmpty { "node" }
        val full = listOf(node, cliPath) + args
        return runRaw(project, cwd, full, runTitle)
    }

    /**
     * `npx package@tag arg1 arg2 ...` with cwd set (matches [packages/cloude-code-toolbox/src/terminal/runNpx.ts]).
     */
    fun runNpx(
        project: Project,
        cwd: Path,
        packageName: String,
        tag: String,
        npxArgs: List<String>,
        runTitle: String,
    ): String? {
        val spec = if (tag.isBlank() || tag == "latest") "${packageName}@latest" else "${packageName}@${tag}"
        val full = listOf("npx", spec) + npxArgs
        return runRaw(project, cwd, full, runTitle)
    }

    fun runRaw(project: Project, cwd: Path, argv: List<String>, runTitle: String): String? {
        if (argv.isEmpty()) return "Empty command."
        return try {
            val cmd = GeneralCommandLine(argv)
            cmd.workDirectory = cwd.toFile()
            // GUI-launched IDEs often have a minimal PATH; use login-shell env so `npx` resolves (Homebrew, nvm, fnm).
            cmd.environment.putAll(EnvironmentUtil.getEnvironmentMap())
            val handler = OSProcessHandler(cmd)
            val console = TextConsoleBuilderFactory.getInstance().createBuilder(project).console
            console.attachToProcess(handler)
            val executor = ExecutorRegistry.getInstance().getExecutorById(DefaultRunExecutor.EXECUTOR_ID)
                ?: return "Could not resolve Run executor."
            val descriptor = RunContentDescriptor(console, handler, console.component, runTitle)
            RunContentManager.getInstance(project).showRunContent(executor, descriptor)
            handler.startNotify()
            null
        } catch (e: Exception) {
            e.message
        }
    }
}
