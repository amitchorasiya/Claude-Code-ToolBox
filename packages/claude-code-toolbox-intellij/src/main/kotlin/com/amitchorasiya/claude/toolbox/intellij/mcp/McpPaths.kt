package com.amitchorasiya.claude.toolbox.intellij.mcp

import java.nio.file.Path
import kotlin.io.path.Path

object McpPaths {

    fun workspaceMcpJson(base: Path): Path = base.resolve(".vscode").resolve("mcp.json")

    fun userMcpJson(): Path = userMcpJson(false)

    /** VS Code stable vs Insiders user config (see [packages/cloude-code-toolbox/src/mcpPaths.ts]). */
    fun userMcpJson(insiders: Boolean): Path {
        val home = Path(System.getProperty("user.home"))
        val dir = if (insiders) "Code - Insiders" else "Code"
        val os = System.getProperty("os.name").lowercase()
        return when {
            os.contains("mac") ->
                home.resolve("Library").resolve("Application Support").resolve(dir).resolve("User").resolve("mcp.json")
            os.contains("win") -> {
                val appData = System.getenv("APPDATA") ?: home.resolve("AppData").resolve("Roaming").toString()
                Path(appData, dir, "User", "mcp.json")
            }
            else -> home.resolve(".config").resolve(dir).resolve("User").resolve("mcp.json")
        }
    }
}
