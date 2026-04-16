package com.amitchorasiya.claude.toolbox.intellij.parity

/** Mirrors [packages/cloude-code-toolbox/src/commands/migrateCursorrules.ts] banners. */
object AppendCursorrulesMerge {

    private const val BANNER_START = "<!-- cloude-code-toolbox:cursorrules-begin -->"
    private const val BANNER_END = "<!-- cloude-code-toolbox:cursorrules-end -->"

    fun mergeBlock(cursorrulesText: String): String {
        val rules = cursorrulesText.trim()
        return listOf(
            "",
            BANNER_START,
            "",
            "## Migrated from `.cursorrules` (via Claude Code ToolBox)",
            "",
            rules,
            "",
            BANNER_END,
            "",
        ).joinToString("\n")
    }

    fun mergeIntoClaudeMd(existingClaudeMd: String, cursorrulesText: String): String {
        val block = mergeBlock(cursorrulesText)
        val trimmed = existingClaudeMd.trim()
        if (trimmed.isEmpty()) {
            return "# Claude Code — project context\n$block"
        }
        if (trimmed.contains(BANNER_START) && trimmed.contains(BANNER_END)) {
            val re = Regex(
                Regex.escape(BANNER_START) + "[\\s\\S]*?" + Regex.escape(BANNER_END) + "\\n*",
                RegexOption.MULTILINE,
            )
            return trimmed.replace(re, block)
        }
        return trimmed.trimEnd() + block
    }
}
