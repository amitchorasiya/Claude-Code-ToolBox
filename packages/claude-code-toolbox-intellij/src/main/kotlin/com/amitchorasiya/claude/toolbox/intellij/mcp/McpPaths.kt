package com.amitchorasiya.claude.toolbox.intellij.mcp

import java.nio.file.Path
import kotlin.io.path.Path

object McpPaths {

    /** Claude Code project MCP: `<workspace>/.mcp.json` */
    fun workspaceMcpJson(base: Path): Path = base.resolve(".mcp.json")

    /** Claude Code user MCP: `~/.claude.json` (key: `mcpServers`) */
    fun userMcpJson(): Path {
        val home = Path(System.getProperty("user.home"))
        return home.resolve(".claude.json")
    }

    /** VS Code user mcp.json (kept for port-from-VS-Code feature). */
    fun vsCodeUserMcpJson(insiders: Boolean = false): Path {
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

    /** Cursor MCP config: `~/.cursor/mcp.json` (key: `mcpServers`) */
    fun cursorMcpJson(): Path {
        val home = Path(System.getProperty("user.home"))
        return home.resolve(".cursor").resolve("mcp.json")
    }
}
