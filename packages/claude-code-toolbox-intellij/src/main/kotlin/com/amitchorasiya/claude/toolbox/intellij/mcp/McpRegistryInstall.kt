package com.amitchorasiya.claude.toolbox.intellij.mcp

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.intellij.openapi.ui.Messages
import java.nio.file.Path

/**
 * Merges a public registry entry into workspace `.mcp.json` (stdio / streamable remote).
 * Simplified vs VS Code: skips some edge cases; prompts for `${input:...}` placeholders when present.
 */
object McpRegistryInstall {

    fun installIntoWorkspace(projectRoot: Path?, entry: JsonObject): String? {
        if (projectRoot == null) {
            return "Open a project folder to install MCP servers."
        }
        val unwrapped = unwrap(entry)
        val serverName = unwrapped.server.get("name")?.asString?.trim()?.ifEmpty { null } ?: "mcp-server"
        val packages = unwrapped.packages
        val remotes = unwrapped.remotes

        val pkg = pickStdioPackage(packages)
        val built = when {
            pkg != null -> buildStdio(serverName, pkg)
            remotes.size() > 0 -> buildRemote(serverName, remotes[0].asJsonObject)
            else -> return "This registry entry has no installable stdio package or supported remote URL."
        }
        if (built.has("error")) {
            return built.get("error")?.asString
        }
        val serverJson = built.getAsJsonObject("config") ?: return "Invalid install config."

        resolveInputs(serverJson)

        val mcpPath = McpPaths.workspaceMcpJson(projectRoot)
        val raw = McpJson.readOrEmpty(mcpPath)
        val servers = McpJson.getServersObject(raw)
        val key = uniqueKey(servers, serverName)
        servers.add(key, serverJson)
        McpJson.writeDocument(mcpPath, raw)
        return null
    }

    private fun uniqueKey(servers: JsonObject, desired: String): String {
        if (!servers.has(desired)) return desired
        var i = 2
        while (servers.has("$desired-$i")) i++
        return "$desired-$i"
    }

    private data class Unwrap(val server: JsonObject, val packages: JsonArray, val remotes: JsonArray)

    private fun unwrap(entry: JsonObject): Unwrap {
        val root = entry.get("server")?.asJsonObject ?: entry
        val name = root.get("name")?.asString ?: "server"
        val server = root.deepCopy()
        server.addProperty("name", name)
        val remotes = if (root.has("remotes") && root.get("remotes").isJsonArray) {
            root.getAsJsonArray("remotes")
        } else {
            JsonArray()
        }
        val packages = if (root.has("packages") && root.get("packages").isJsonArray) {
            root.getAsJsonArray("packages")
        } else {
            JsonArray()
        }
        return Unwrap(server, packages, remotes)
    }

    private fun pickStdioPackage(packages: JsonArray): JsonObject? {
        if (packages.size() == 0) return null
        for (el in packages) {
            if (!el.isJsonObject) continue
            val p = el.asJsonObject
            val transport = p.get("transport")?.asJsonObject
            val t = transport?.get("type")?.asString?.lowercase() ?: ""
            if (t == "stdio") return p
        }
        return packages[0].asJsonObject
    }

    private fun buildStdio(serverName: String, pkg: JsonObject): JsonObject {
        val out = JsonObject()
        val command = runtimeCommand(pkg) ?: return out.apply { addProperty("error", "No supported runtime (npx/uvx).") }
        val identifier = pkg.get("identifier")?.asString ?: ""
        val version = pkg.get("version")?.asString
        val args = JsonArray()
        if (command == "npx") {
            val spec = if (!version.isNullOrEmpty() && version != "latest") "$identifier@$version" else identifier
            args.add("-y")
            args.add(spec)
        } else if (command == "uvx") {
            val spec = if (!version.isNullOrEmpty() && version.isNotBlank()) "$identifier==$version" else identifier
            args.add(spec)
        }
        val cfg = JsonObject()
        cfg.addProperty("type", "stdio")
        cfg.addProperty("command", command)
        if (args.size() > 0) cfg.add("args", args)
        out.add("config", cfg)
        return out
    }

    private fun buildRemote(serverName: String, remote: JsonObject): JsonObject {
        val url = remote.get("url")?.asString?.trim() ?: return JsonObject().apply {
            addProperty("error", "Remote entry has no URL.")
        }
        val rawType = remote.get("type")?.asString?.lowercase() ?: "http"
        if (rawType != "streamable-http" && rawType != "sse") {
            return JsonObject().apply { addProperty("error", "Remote type \"$rawType\" not supported for one-click install.") }
        }
        val transportType = if (rawType == "sse") "sse" else "http"
        val cfg = JsonObject()
        cfg.addProperty("type", transportType)
        cfg.addProperty("url", url)
        val out = JsonObject()
        out.add("config", cfg)
        return out
    }

    private fun runtimeCommand(pkg: JsonObject): String? {
        val hint = pkg.get("runtimeHint")?.asString?.trim()
        if (!hint.isNullOrEmpty()) return hint
        val rt = pkg.get("registryType")?.asString?.lowercase() ?: ""
        return when (rt) {
            "npm" -> "npx"
            "pypi" -> "uvx"
            else -> null
        }
    }

    private fun resolveInputs(serverJson: JsonObject) {
        val text = serverJson.toString()
        if (!text.contains("\${input:")) return
        Messages.showWarningDialog(
            "This server needs extra inputs (API keys, etc.). Edit `.mcp.json` after install to fill placeholders.",
            "Claude Code ToolBox",
        )
    }

    private fun JsonObject.deepCopy(): JsonObject =
        com.google.gson.JsonParser.parseString(this.toString()).asJsonObject
}
