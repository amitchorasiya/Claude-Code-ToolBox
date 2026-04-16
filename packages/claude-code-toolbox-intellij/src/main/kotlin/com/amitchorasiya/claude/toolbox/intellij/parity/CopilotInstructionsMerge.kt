package com.amitchorasiya.claude.toolbox.intellij.parity

/** Mirrors [packages/cloude-code-toolbox/src/commands/mergeCopilotInstructionsCore.ts]. */
object CopilotInstructionsMerge {

    const val COPILOT_INSTRUCTIONS_MIGRATE_BEGIN = "<!-- cloude-code-toolbox:copilot-instructions-begin -->"
    const val COPILOT_INSTRUCTIONS_MIGRATE_END = "<!-- cloude-code-toolbox:copilot-instructions-end -->"

    fun buildMigrateBlock(copilotInstructionsBody: String): String {
        val body = copilotInstructionsBody.trim()
        return listOf(
            "",
            COPILOT_INSTRUCTIONS_MIGRATE_BEGIN,
            "",
            "## Migrated from `.github/copilot-instructions.md` (via Claude Code ToolBox)",
            "",
            body,
            "",
            COPILOT_INSTRUCTIONS_MIGRATE_END,
            "",
        ).joinToString("\n")
    }

    fun mergeIntoClaudeMd(existingClaudeMd: String, copilotInstructionsBody: String): String {
        val block = buildMigrateBlock(copilotInstructionsBody)
        val trimmed = existingClaudeMd.trim()
        if (trimmed.isEmpty()) {
            return "# Claude Code — project context\n$block"
        }
        if (trimmed.contains(COPILOT_INSTRUCTIONS_MIGRATE_BEGIN) && trimmed.contains(COPILOT_INSTRUCTIONS_MIGRATE_END)) {
            val re = Regex(
                Regex.escape(COPILOT_INSTRUCTIONS_MIGRATE_BEGIN) + "[\\s\\S]*?" + Regex.escape(COPILOT_INSTRUCTIONS_MIGRATE_END) + "\\n*",
                RegexOption.MULTILINE,
            )
            return trimmed.replace(re, block)
        }
        return trimmed.trimEnd() + block
    }
}
