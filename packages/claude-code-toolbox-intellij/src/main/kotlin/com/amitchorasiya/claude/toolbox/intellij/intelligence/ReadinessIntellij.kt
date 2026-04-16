package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
private const val COPILOT_BEGIN = "<!-- cloude-code-toolbox:copilot-instructions-begin -->"

private data class FileFact(val exists: Boolean, val byteLength: Long, val mtimeMs: Long?)

private data class ReadinessInput(
    val claudeMd: FileFact,
    val claudeMdHasCopilotMigrateBlock: Boolean,
    val agentsMd: FileFact,
    val claudeRulesFileCount: Int,
    val memoryBankDirExists: Boolean,
    val workspaceMcpJson: FileFact,
    val cursorrules: FileFact,
    val cursorRulesDirHasFiles: Boolean,
    val copilotInstructionsMd: FileFact,
)

private data class ReadinessCheck(val id: String, val ok: Boolean, val message: String, val suggestedCommand: String?)

/** Mirrors [packages/cloude-code-toolbox/src/intelligence/readiness.ts] + [buildReadinessInput.ts]. */
object ReadinessIntellij {

    fun runAndOpenReport(project: Project) {
        val base = project.basePath ?: return
        val root = Path.of(base)
        val input = gatherInput(root)
        val checks = evaluate(input)
        val md = formatMarkdown(checks)
        val out = root.resolve(".claude").resolve("cloude-code-toolbox-readiness.md")
        Files.createDirectories(out.parent)
        Files.writeString(out, md, StandardCharsets.UTF_8)
        val vf = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(out.toFile()) ?: return
        FileEditorManager.getInstance(project).openFile(vf, true)
    }

    private fun gatherInput(root: Path): ReadinessInput {
        val claude = root.resolve("CLAUDE.md")
        val claudeFact = fact(claude)
        var hasCopilot = false
        if (claudeFact.exists) {
            val text = Files.readString(claude, StandardCharsets.UTF_8)
            hasCopilot = text.contains(COPILOT_BEGIN)
        }
        return ReadinessInput(
            claudeMd = claudeFact,
            claudeMdHasCopilotMigrateBlock = hasCopilot,
            agentsMd = fact(root.resolve("AGENTS.md")),
            claudeRulesFileCount = countMdFiles(root.resolve(".claude").resolve("rules")),
            memoryBankDirExists = Files.isDirectory(root.resolve("memory-bank")),
            workspaceMcpJson = fact(root.resolve(".vscode").resolve("mcp.json")),
            cursorrules = fact(root.resolve(".cursorrules")),
            cursorRulesDirHasFiles = hasCursorRulesFiles(root.resolve(".cursor").resolve("rules")),
            copilotInstructionsMd = fact(root.resolve(".github").resolve("copilot-instructions.md")),
        )
    }

    private fun fact(p: Path): FileFact {
        if (!Files.exists(p) || Files.isDirectory(p)) {
            return FileFact(false, 0, null)
        }
        val size = Files.size(p)
        val mtime = Files.getLastModifiedTime(p).toMillis()
        return FileFact(true, size, mtime)
    }

    private fun countMdFiles(dir: Path): Int {
        if (!Files.isDirectory(dir)) return 0
        return try {
            Files.list(dir).use { stream ->
                stream.filter { Files.isRegularFile(it) && it.fileName.toString().endsWith(".md") }.count()
                    .toInt()
            }
        } catch (_: Exception) {
            0
        }
    }

    private fun hasCursorRulesFiles(dir: Path): Boolean {
        if (!Files.isDirectory(dir)) return false
        return try {
            Files.list(dir).use { stream ->
                stream.anyMatch {
                    Files.isRegularFile(it) && (it.fileName.toString().endsWith(".mdc") || it.fileName.toString()
                        .endsWith(".md"))
                }
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun emptyish(f: FileFact): Boolean = f.exists && f.byteLength <= 12

    private fun evaluate(input: ReadinessInput): List<ReadinessCheck> {
        val checks = mutableListOf<ReadinessCheck>()
        checks.add(
            ReadinessCheck(
                id = "claude-md",
                ok = input.claudeMd.exists && !emptyish(input.claudeMd),
                message = when {
                    !input.claudeMd.exists -> "Missing `CLAUDE.md` at workspace root."
                    emptyish(input.claudeMd) -> "`CLAUDE.md` exists but is nearly empty."
                    else -> "`CLAUDE.md` looks populated."
                },
                suggestedCommand = if (!input.claudeMd.exists) "CloudeCodeToolBox.runOneClickSetup" else "CloudeCodeToolBox.openInstructionsPicker",
            ),
        )
        checks.add(
            ReadinessCheck(
                id = "claude-rules",
                ok = true,
                message = if (input.claudeRulesFileCount == 0) {
                    "No `.claude/rules/*.md` files (optional scoped rules)."
                } else {
                    "Found ${input.claudeRulesFileCount} markdown file(s) under .claude/rules/."
                },
                suggestedCommand = "CloudeCodeToolBox.syncCursorRules",
            ),
        )
        checks.add(
            ReadinessCheck(
                id = "mcp-json",
                ok = input.workspaceMcpJson.exists,
                message = if (input.workspaceMcpJson.exists) {
                    "Workspace `.vscode/mcp.json` present."
                } else {
                    "Workspace `.vscode/mcp.json` missing."
                },
                suggestedCommand = "CloudeCodeToolBox.portCursorMcp",
            ),
        )
        checks.add(
            ReadinessCheck(
                id = "cursorrules",
                ok = input.cursorrules.exists || input.cursorRulesDirHasFiles,
                message = if (input.cursorrules.exists || input.cursorRulesDirHasFiles) {
                    "Cursor rules (`.cursorrules` and/or `.cursor/rules`) present."
                } else {
                    "No `.cursorrules` or `.cursor/rules` files detected."
                },
                suggestedCommand = "CloudeCodeToolBox.createCursorrulesTemplate",
            ),
        )
        val copilotLegacy = input.copilotInstructionsMd.exists && !emptyish(input.copilotInstructionsMd) && input.claudeMd.exists
        checks.add(
            ReadinessCheck(
                id = "copilot-instructions-legacy",
                ok = !copilotLegacy || input.claudeMdHasCopilotMigrateBlock,
                message = when {
                    !input.copilotInstructionsMd.exists -> "No `.github/copilot-instructions.md`."
                    emptyish(input.copilotInstructionsMd) -> "File nearly empty."
                    input.claudeMdHasCopilotMigrateBlock -> "Copilot block marker present in CLAUDE.md."
                    else -> "Copilot instructions exist but CLAUDE.md has no merged block."
                },
                suggestedCommand = "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd",
            ),
        )
        val cr = input.cursorrules
        val cm = input.claudeMd
        if (cr.exists && cr.mtimeMs != null && cm.exists && cm.mtimeMs != null) {
            val newer = cr.mtimeMs > cm.mtimeMs
            checks.add(
                ReadinessCheck(
                    id = "cursorrules-mtime",
                    ok = !newer,
                    message = if (newer) {
                        "`.cursorrules` is newer than `CLAUDE.md` — consider syncing."
                    } else {
                        "`CLAUDE.md` is at least as new as `.cursorrules`."
                    },
                    suggestedCommand = "CloudeCodeToolBox.appendCursorrules",
                ),
            )
        }
        return checks
    }

    private fun formatMarkdown(checks: List<ReadinessCheck>): String {
        val lines = mutableListOf<String>()
        lines.add("# Claude Code ToolBox — Intelligence readiness")
        lines.add("")
        lines.add("_(IntelliJ parity report — same checks as VS Code extension.)_")
        lines.add("")
        for (c in checks) {
            val icon = if (c.ok) "✓" else "○"
            lines.add("## $icon ${c.id}")
            lines.add(c.message)
            c.suggestedCommand?.let { lines.add(""); lines.add("Suggested: `$it`") }
            lines.add("")
        }
        return lines.joinToString("\n")
    }
}
