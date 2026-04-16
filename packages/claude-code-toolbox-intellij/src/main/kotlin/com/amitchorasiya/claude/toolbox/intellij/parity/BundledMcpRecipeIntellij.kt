package com.amitchorasiya.claude.toolbox.intellij.parity

import com.amitchorasiya.claude.toolbox.intellij.mcp.McpJson
import com.amitchorasiya.claude.toolbox.intellij.ui.ToolboxDialogUi
import com.amitchorasiya.claude.toolbox.intellij.mcp.McpPaths
import com.amitchorasiya.claude.toolbox.intellij.hub.ClaudeHubBridge
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import java.nio.charset.StandardCharsets
import java.nio.file.Path

/** Mirrors [packages/cloude-code-toolbox/src/commands/mcpRecipeCommand.ts]. */
object BundledMcpRecipeIntellij {

    private val INPUT_RE = Regex("^\\$\\{input:([^}]+)}$")

    fun run(project: Project) {
        val base = project.basePath ?: run {
            Messages.showErrorDialog(project, "Open a workspace folder first.", "Claude Code ToolBox")
            return
        }
        val root = Path.of(base)
        val stream = javaClass.classLoader.getResourceAsStream("mcp-recipes/bundled-recipes.json")
            ?: run {
                Messages.showErrorDialog(project, "Bundled MCP recipes missing from plugin.", "Claude Code ToolBox")
                return
            }
        val raw = stream.use { it.readBytes().toString(StandardCharsets.UTF_8) }
        val data = try {
            JsonParser.parseString(raw).asJsonObject
        } catch (_: Exception) {
            Messages.showErrorDialog(project, "Invalid bundled recipes JSON.", "Claude Code ToolBox")
            return
        }
        val recipes = data.getAsJsonArray("recipes") ?: run {
            Messages.showErrorDialog(project, "No recipes defined.", "Claude Code ToolBox")
            return
        }
        if (recipes.size() == 0) {
            Messages.showErrorDialog(project, "No recipes defined.", "Claude Code ToolBox")
            return
        }
        val labels = mutableListOf<String>()
        val recipeObjs = mutableListOf<JsonObject>()
        for (el in recipes) {
            if (!el.isJsonObject) continue
            val o = el.asJsonObject
            val label = o.get("label")?.asString ?: o.get("id")?.asString ?: "?"
            labels.add(label)
            recipeObjs.add(o)
        }
        if (labels.isEmpty()) return
        val arr = labels.toTypedArray()
        val idx = ToolboxDialogUi.showChooseDialog(
            project,
            "Merge a sample server into .vscode/mcp.json",
            "Apply bundled MCP recipe",
            Messages.getQuestionIcon(),
            arr,
            arr[0],
        )
        if (idx < 0) return
        val recipe = recipeObjs[idx]
        val serverKey = recipe.get("serverKey")?.asString?.trim().orEmpty()
        if (serverKey.isEmpty()) {
            Messages.showErrorDialog(project, "Invalid recipe serverKey.", "Claude Code ToolBox")
            return
        }
        val cfgEl = recipe.get("config") ?: run {
            Messages.showErrorDialog(project, "Invalid recipe config.", "Claude Code ToolBox")
            return
        }
        val mergedConfig = deepReplaceInputs(cfgEl) { key, desc ->
            Messages.showInputDialog(project, desc, "MCP recipe input: $key", Messages.getQuestionIcon())
        }
        if (mergedConfig == null || !mergedConfig.isJsonObject) {
            Messages.showErrorDialog(project, "Could not build server config.", "Claude Code ToolBox")
            return
        }
        val mcpPath = McpPaths.workspaceMcpJson(root)
        val rootDoc = McpJson.readOrEmpty(mcpPath)
        val servers = McpJson.getServersObject(rootDoc)
        if (servers.has(serverKey)) {
            val ok = Messages.showYesNoDialog(
                project,
                "Server \"$serverKey\" already exists in mcp.json. Overwrite?",
                "Overwrite server",
                Messages.getWarningIcon(),
            )
            if (ok != Messages.YES) return
        }
        servers.add(serverKey, mergedConfig)
        val out = com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(rootDoc) + "\n"
        ParityScratchFiles.openUnderClaude(project, "mcp-json-merge-preview.json", out)
        val apply = Messages.showYesNoDialog(
            project,
            "Write merged mcp.json to .vscode/mcp.json?",
            "Confirm write",
            Messages.getWarningIcon(),
        )
        if (apply != Messages.YES) return
        McpJson.writeDocument(mcpPath, rootDoc)
        Messages.showInfoMessage(project, "Updated .vscode/mcp.json (server \"$serverKey\").", "Claude Code ToolBox")
        project.getService(ClaudeHubBridge::class.java).refreshHub()
    }

    private fun deepReplaceInputs(el: JsonElement, prompt: (String, String) -> String?): JsonElement? {
        when {
            el.isJsonPrimitive && el.asJsonPrimitive.isString -> {
                val s = el.asString
                val m = INPUT_RE.matchEntire(s) ?: return el
                val key = m.groupValues[1].trim()
                val v = prompt(key, "Value for $key") ?: ""
                return JsonPrimitive(v)
            }
            el.isJsonArray -> {
                val arr = JsonArray()
                for (x in el.asJsonArray) {
                    arr.add(deepReplaceInputs(x, prompt) ?: return null)
                }
                return arr
            }
            el.isJsonObject -> {
                val o = JsonObject()
                for (e in el.asJsonObject.entrySet()) {
                    val next = deepReplaceInputs(e.value, prompt) ?: return null
                    o.add(e.key, next)
                }
                return o
            }
            else -> return el
        }
    }
}
