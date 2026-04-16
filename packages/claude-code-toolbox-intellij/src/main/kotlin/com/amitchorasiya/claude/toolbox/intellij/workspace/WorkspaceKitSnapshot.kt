package com.amitchorasiya.claude.toolbox.intellij.workspace

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile

/** Mirrors [packages/cloude-code-toolbox/src/tree/workspaceKitProvider.ts] KIT_CHECKS. */
object WorkspaceKitSnapshot {

    private data class Check(val id: String, val label: String, val rel: String, val runCommand: String?)

    private val CHECKS = listOf(
        Check("cursor-rules-dir", "Cursor rules", ".cursor/rules", "CloudeCodeToolBox.syncCursorRules"),
        Check("cursorrules-file", ".cursorrules", ".cursorrules", "CloudeCodeToolBox.createCursorrulesTemplate"),
        Check("memory-bank", "Memory bank", "memory-bank", "CloudeCodeToolBox.initMemoryBank"),
        Check("claude-md", "CLAUDE.md", "CLAUDE.md", null),
        Check("mcp-json", "Workspace mcp.json", ".vscode/mcp.json", "CloudeCodeToolBox.portCursorMcp"),
    )

    fun gather(base: Path?): JsonArray {
        val arr = JsonArray()
        if (base == null) {
            val row = JsonObject()
            row.addProperty("id", "no-folder")
            row.addProperty("label", "Open a workspace folder")
            row.addProperty("present", false)
            row.addProperty("displayPath", "")
            arr.add(row)
            return arr
        }
        for (c in CHECKS) {
            val p = base.resolve(c.rel)
            val present = when {
                c.rel.endsWith("rules") -> Files.isDirectory(p)
                else -> p.isRegularFile() || (c.rel.contains("mcp") && p.isRegularFile())
            } || (Files.exists(p) && (Files.isDirectory(p) || Files.isRegularFile(p)))
            val row = JsonObject()
            row.addProperty("id", c.id)
            row.addProperty("label", c.label)
            row.addProperty("present", present)
            row.addProperty("displayPath", c.rel)
            if (c.runCommand != null) row.addProperty("runCommand", c.runCommand)
            if (present && !c.rel.endsWith("rules")) {
                row.addProperty("openUri", p.toAbsolutePath().normalize().toString())
            }
            if (c.rel.endsWith("rules") && present) {
                row.addProperty("openUri", p.toAbsolutePath().normalize().toString())
                row.addProperty("isDirectory", true)
            }
            if (c.id == "ocs-wizard") {
                row.addProperty("isWizard", true)
            }
            arr.add(row)
        }
        return arr
    }
}
