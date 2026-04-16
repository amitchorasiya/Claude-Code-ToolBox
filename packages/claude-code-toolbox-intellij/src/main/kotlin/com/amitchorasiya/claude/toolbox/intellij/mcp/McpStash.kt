package com.amitchorasiya.claude.toolbox.intellij.mcp

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists

/**
 * Disabled MCP server configs (Turn OFF). Workspace stash: `<project>/.cloude/toolbox-mcp-stash-workspace.json`.
 * User stash: `~/.cloude/toolbox-mcp-stash-user.json`.
 */
sealed class McpStash {

    abstract fun stashPath(): Path?

    protected val gson = Gson()

    protected fun loadFlat(): JsonObject {
        val p = stashPath() ?: return JsonObject()
        if (!p.exists()) return JsonObject()
        return try {
            JsonParser.parseString(Files.readString(p, StandardCharsets.UTF_8)).asJsonObject
        } catch (_: Exception) {
            JsonObject()
        }
    }

    protected fun saveFlat(root: JsonObject) {
        val p = stashPath() ?: return
        p.parent?.createDirectories()
        Files.writeString(p, gson.toJson(root) + "\n", StandardCharsets.UTF_8)
    }

    abstract fun stashDisabled(serverId: String, config: JsonObject)
    abstract fun popDisabled(serverId: String): JsonObject?
    abstract fun removeStashEntry(serverId: String)
    abstract fun listStashed(): Map<String, JsonObject>

    class Workspace(private val projectRoot: Path) : McpStash() {
        override fun stashPath() = projectRoot.resolve(".cloude").resolve("toolbox-mcp-stash-workspace.json")

        override fun stashDisabled(serverId: String, config: JsonObject) {
            val root = loadFlat()
            root.add(serverId, config)
            saveFlat(root)
        }

        override fun popDisabled(serverId: String): JsonObject? {
            val root = loadFlat()
            val el = root.remove(serverId) ?: return null
            saveFlat(root)
            return if (el.isJsonObject) el.asJsonObject else null
        }

        override fun removeStashEntry(serverId: String) {
            val root = loadFlat()
            root.remove(serverId)
            saveFlat(root)
        }

        override fun listStashed(): Map<String, JsonObject> {
            val root = loadFlat()
            val out = mutableMapOf<String, JsonObject>()
            for (e in root.entrySet()) {
                if (e.value.isJsonObject) out[e.key] = e.value.asJsonObject
            }
            return out
        }
    }

    class User : McpStash() {
        override fun stashPath(): Path {
            val home = Path.of(System.getProperty("user.home"))
            return home.resolve(".cloude").resolve("toolbox-mcp-stash-user.json")
        }

        override fun stashDisabled(serverId: String, config: JsonObject) {
            val root = loadFlat()
            root.add(serverId, config)
            saveFlat(root)
        }

        override fun popDisabled(serverId: String): JsonObject? {
            val root = loadFlat()
            val el = root.remove(serverId) ?: return null
            saveFlat(root)
            return if (el.isJsonObject) el.asJsonObject else null
        }

        override fun removeStashEntry(serverId: String) {
            val root = loadFlat()
            root.remove(serverId)
            saveFlat(root)
        }

        override fun listStashed(): Map<String, JsonObject> {
            val root = loadFlat()
            val out = mutableMapOf<String, JsonObject>()
            for (e in root.entrySet()) {
                if (e.value.isJsonObject) out[e.key] = e.value.asJsonObject
            }
            return out
        }
    }
}
