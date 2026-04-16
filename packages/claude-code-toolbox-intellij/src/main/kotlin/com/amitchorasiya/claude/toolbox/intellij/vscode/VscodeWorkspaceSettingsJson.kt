package com.amitchorasiya.claude.toolbox.intellij.vscode

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists

/**
 * Minimal read/write of workspace `.vscode/settings.json` for keys the VS Code extension toggles
 * (e.g. `chat.mcp.discovery.enabled`).
 */
object VscodeWorkspaceSettingsJson {

    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    fun toggleChatMcpDiscovery(projectRoot: Path): String? {
        val path = projectRoot.resolve(".vscode").resolve("settings.json")
        val root = if (path.exists()) {
            try {
                JsonParser.parseString(Files.readString(path, StandardCharsets.UTF_8)).asJsonObject
            } catch (_: Exception) {
                JsonObject()
            }
        } else {
            JsonObject()
        }
        val cur = root.get("chat.mcp.discovery.enabled")?.asBoolean
        val next = !(cur == true)
        root.addProperty("chat.mcp.discovery.enabled", next)
        try {
            path.parent?.createDirectories()
            Files.writeString(path, gson.toJson(root) + "\n", StandardCharsets.UTF_8)
        } catch (e: Exception) {
            return e.message ?: "Could not write settings.json"
        }
        return null
    }
}
