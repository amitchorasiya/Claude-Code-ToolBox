package com.amitchorasiya.claude.toolbox.intellij.skills

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists

/** Hub-only hide flags persisted under `.cloude/toolbox-skill-hub.json`. */
class SkillHubState(private val projectRoot: Path?) {

    private val gson = Gson()
    private val path: Path?
        get() = projectRoot?.resolve(".cloude")?.resolve("toolbox-skill-hub.json")

    private fun load(): JsonObject {
        val p = path ?: return JsonObject()
        if (!p.exists()) return JsonObject()
        return try {
            JsonParser.parseString(Files.readString(p, StandardCharsets.UTF_8)).asJsonObject
        } catch (_: Exception) {
            JsonObject()
        }
    }

    private fun save(o: JsonObject) {
        val p = path ?: return
        p.parent?.createDirectories()
        Files.writeString(p, gson.toJson(o) + "\n", StandardCharsets.UTF_8)
    }

    fun isDisabled(skillId: String): Boolean {
        val arr = load().getAsJsonArray("disabledIds") ?: return false
        return arr.any { it.asString == skillId }
    }

    fun setDisabled(skillId: String, disabled: Boolean) {
        val root = load()
        var arr = root.getAsJsonArray("disabledIds") ?: JsonArray().also { root.add("disabledIds", it) }
        val list = arr.map { it.asString }.toMutableList()
        if (disabled) {
            if (!list.contains(skillId)) list.add(skillId)
        } else {
            list.remove(skillId)
        }
        arr = JsonArray()
        for (s in list) arr.add(s)
        root.add("disabledIds", arr)
        save(root)
    }
}
