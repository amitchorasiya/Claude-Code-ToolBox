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

/** Mirrors [packages/cloude-code-toolbox/src/registry/mcpRegistryClient.ts]. */
object RegistryHttp {

    private const val REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0/servers"
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(25))
        .build()

    data class Result(
        val servers: JsonArray,
        val nextCursor: String?,
        val error: String?,
    )

    fun search(search: String, limit: Int = 12, cursor: String? = null): Result {
        val q = search.trim()
        if (q.isEmpty()) {
            return Result(JsonArray(), null, null)
        }
        val lim = limit.coerceIn(1, 50)
        return try {
            val ub = StringBuilder(REGISTRY_BASE).append("?version=latest&limit=").append(lim)
                .append("&search=").append(URLEncoder.encode(q, StandardCharsets.UTF_8))
            if (!cursor.isNullOrBlank()) {
                ub.append("&cursor=").append(URLEncoder.encode(cursor, StandardCharsets.UTF_8))
            }
            val req = HttpRequest.newBuilder()
                .uri(URI.create(ub.toString()))
                .timeout(Duration.ofSeconds(25))
                .header("Accept", "application/json")
                .GET()
                .build()
            val res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            if (res.statusCode() !in 200..299) {
                return Result(JsonArray(), null, "Registry HTTP ${res.statusCode()}")
            }
            val root = JsonParser.parseString(res.body()).asJsonObject
            val servers = root.getAsJsonArray("servers") ?: JsonArray()
            val meta = root.getAsJsonObject("metadata")
            val next = meta?.get("nextCursor")?.asString ?: meta?.get("next_cursor")?.asString
            Result(servers, next, null)
        } catch (e: Exception) {
            Result(JsonArray(), null, e.message ?: "registry search failed")
        }
    }
}
