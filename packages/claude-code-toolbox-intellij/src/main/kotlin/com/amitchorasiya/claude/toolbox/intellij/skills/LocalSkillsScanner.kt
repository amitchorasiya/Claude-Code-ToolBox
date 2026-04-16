package com.amitchorasiya.claude.toolbox.intellij.skills

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.streams.toList

/** Mirrors [packages/cloude-code-toolbox/src/skills/localSkills.ts] roots. */
object LocalSkillsScanner {

    private val USER_ROOTS = listOf(
        listOf(".copilot", "skills"),
        listOf(".claude", "skills"),
        listOf(".agents", "skills"),
        listOf(".cursor", "skills"),
    )
    private val WS_ROOTS = listOf(
        listOf(".github", "skills"),
        listOf(".claude", "skills"),
        listOf(".agents", "skills"),
        listOf(".cursor", "skills"),
    )

    fun collect(home: Path, workspaceRoot: Path?, hub: SkillHubState): JsonArray {
        val seen = mutableSetOf<String>()
        val out = JsonArray()
        if (workspaceRoot != null) {
            scanRoots(workspaceRoot, WS_ROOTS, "workspace", seen, out, hub)
        }
        scanRoots(home, USER_ROOTS, "user", seen, out, hub)
        return out
    }

    private fun scanRoots(
        base: Path,
        roots: List<List<String>>,
        scope: String,
        seen: MutableSet<String>,
        out: JsonArray,
        hub: SkillHubState,
    ) {
        for (segments in roots) {
            var p = base
            for (s in segments) {
                p = p.resolve(s)
            }
            if (!p.isDirectory()) continue
            val entries = try {
                Files.list(p).use { it.toList() }
            } catch (_: Exception) {
                continue
            }
            for (dir in entries) {
                if (!Files.isDirectory(dir)) continue
                val skillMd = dir.resolve("SKILL.md")
                if (!skillMd.isRegularFile()) continue
                val rootPath = dir.toAbsolutePath().normalize().toString()
                val key = skillMd.toString().lowercase()
                if (seen.contains(key)) continue
                seen.add(key)
                val id = "$scope:$rootPath"
                val o = JsonObject()
                o.addProperty("id", id)
                o.addProperty("name", dir.fileName.toString())
                o.addProperty("description", readDescription(skillMd))
                o.addProperty("rootPath", rootPath)
                o.addProperty("skillMdPath", skillMd.toAbsolutePath().normalize().toString())
                o.addProperty("scope", scope)
                o.addProperty("disabled", hub.isDisabled(id))
                out.add(o)
            }
        }
    }

    private fun readDescription(skillMd: Path): String {
        return try {
            val text = Files.readString(skillMd)
            val fm = Regex("^---\\s*\\n([\\s\\S]*?)\\n---").find(text)
            if (fm != null) {
                val desc = Regex("description:\\s*(.+)", RegexOption.IGNORE_CASE).find(fm.groupValues[1])
                if (desc != null) {
                    return desc.groupValues[1].trim().trim('"', '\'').take(220)
                }
            }
            val body = text.replaceFirst(Regex("^---[\\s\\S]*?---\\s*"), "").trim()
            body.lineSequence().firstOrNull { it.isNotBlank() && !it.trimStart().startsWith("#") }?.trim()?.take(220)
                ?: "Skill (SKILL.md)"
        } catch (_: Exception) {
            ""
        }
    }
}
