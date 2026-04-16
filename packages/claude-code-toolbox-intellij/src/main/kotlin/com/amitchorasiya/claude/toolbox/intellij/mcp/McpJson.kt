package com.amitchorasiya.claude.toolbox.intellij.mcp

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists
import kotlin.io.path.isRegularFile

private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

object McpJson {

    fun summarizeServer(id: String, cfg: com.google.gson.JsonElement?): ServerRow {
        if (cfg == null || !cfg.isJsonObject) {
            return ServerRow(id, "?", "invalid entry", "unknown")
        }
        val o = cfg.asJsonObject
        val t = o.get("type")?.asString ?: ""
        val cmd = o.get("command")?.asString
        if (cmd != null) {
            val argsEl = o.get("args")
            val argsStr = if (argsEl != null && argsEl.isJsonArray) {
                argsEl.asJsonArray.mapNotNull { it.asString }.joinToString(" ")
            } else ""
            val detail = if (argsStr.isNotEmpty()) "$cmd $argsStr" else cmd
            return ServerRow(id, t.ifEmpty { "stdio" }, detail, "stdio")
        }
        val url = o.get("url")?.asString
        if (url != null) {
            return ServerRow(id, t.ifEmpty { "http" }, url, "http")
        }
        return ServerRow(id, t.ifEmpty { "?" }, gson.toJson(o).take(80), "?")
    }

    data class ServerRow(val id: String, val kind: String, val detail: String, val transport: String)

    fun readDocument(path: Path): JsonObject? {
        if (!path.exists() || !path.isRegularFile()) return null
        return try {
            val text = Files.readString(path, StandardCharsets.UTF_8)
            val parsed = com.google.gson.JsonParser.parseString(text)
            if (parsed.isJsonObject) parsed.asJsonObject else null
        } catch (_: Exception) {
            null
        }
    }

    fun readOrEmpty(path: Path): JsonObject {
        val doc = readDocument(path)
        if (doc != null) return doc
        return JsonObject().apply { add("servers", JsonObject()) }
    }

    fun getServersObject(raw: JsonObject): JsonObject {
        var s = raw.get("servers")
        if (s == null || !s.isJsonObject) {
            val next = JsonObject()
            raw.add("servers", next)
            return next
        }
        return s.asJsonObject
    }

    fun writeDocument(path: Path, raw: JsonObject) {
        val parent = path.parent
        if (parent != null && !parent.exists()) {
            parent.createDirectories()
        }
        val text = gson.toJson(raw) + "\n"
        Files.writeString(path, text, StandardCharsets.UTF_8)
    }
}
