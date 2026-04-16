package com.amitchorasiya.claude.toolbox.intellij.mcp

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class McpJsonTest {

    @Test
    fun summarizeStdio() {
        val cfg = JsonObject()
        cfg.addProperty("type", "stdio")
        cfg.addProperty("command", "npx")
        val args = JsonArray()
        args.add("-y")
        args.add("pkg")
        cfg.add("args", args)
        val row = McpJson.summarizeServer("srv", cfg)
        assertEquals("stdio", row.kind)
        assertTrue(row.detail.contains("npx"))
        assertTrue(row.detail.contains("pkg"))
    }

    @Test
    fun summarizeRemoteUrl() {
        val cfg = JsonObject()
        cfg.addProperty("type", "http")
        cfg.addProperty("url", "https://example.com/mcp")
        val row = McpJson.summarizeServer("r", cfg)
        assertEquals("http", row.kind)
        assertEquals("https://example.com/mcp", row.detail)
    }
}
