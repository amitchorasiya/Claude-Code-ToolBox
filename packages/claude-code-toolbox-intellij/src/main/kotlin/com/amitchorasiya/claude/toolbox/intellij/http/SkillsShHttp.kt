package com.amitchorasiya.claude.toolbox.intellij.http

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

/** Mirrors [packages/cloude-code-toolbox/src/registry/skillsShClient.ts]. */
object SkillsShHttp {

    private const val DEFAULT_BASE = "https://skills.sh"
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(25))
        .build()

    data class Result(val items: JsonArray, val error: String?)

    fun search(query: String, limit: Int = 15): Result {
        val q = query.trim()
        if (q.isEmpty()) {
            return Result(JsonArray(), null)
        }
        val lim = limit.coerceIn(1, 50)
        return try {
            val base = DEFAULT_BASE.trimEnd('/')
            val url = "$base/api/search?q=${URLEncoder.encode(q, StandardCharsets.UTF_8)}&limit=$lim"
            val req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(25))
                .header("Accept", "application/json")
                .GET()
                .build()
            val res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            if (res.statusCode() !in 200..299) {
                return Result(JsonArray(), "skills.sh HTTP ${res.statusCode()}")
            }
            val raw = JsonParser.parseString(res.body()).asJsonObject
            val rows = raw.getAsJsonArray("skills") ?: JsonArray()
            val out = JsonArray()
            for (el in rows) {
                if (!el.isJsonObject) continue
                val x = el.asJsonObject
                val id = x.get("id")?.asString?.trim() ?: continue
                val skillId = x.get("skillId")?.asString?.trim() ?: continue
                val name = x.get("name")?.asString?.trim() ?: continue
                val source = x.get("source")?.asString?.trim() ?: continue
                val item = JsonObject()
                item.addProperty("id", id)
                item.addProperty("skillId", skillId)
                item.addProperty("name", name)
                item.addProperty("source", source)
                item.addProperty("installs", x.get("installs")?.asInt ?: 0)
                out.add(item)
            }
            Result(out, null)
        } catch (e: Exception) {
            Result(JsonArray(), e.message ?: "skills search failed")
        }
    }
}
