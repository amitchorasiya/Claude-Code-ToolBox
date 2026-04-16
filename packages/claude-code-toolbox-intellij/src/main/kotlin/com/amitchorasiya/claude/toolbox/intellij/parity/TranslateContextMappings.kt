package com.amitchorasiya.claude.toolbox.intellij.parity

/** Mirrors [packages/cloude-code-toolbox/src/commands/cursorChatMappings.ts]. */
object TranslateContextMappings {

    private val SUBSTITUTIONS: List<Pair<Regex, String>> = listOf(
        Regex("@codebase\\b", RegexOption.IGNORE_CASE) to "@workspace",
        Regex("@docs\\b", RegexOption.IGNORE_CASE) to "@vscode",
        Regex("@web\\b", RegexOption.IGNORE_CASE) to "(web: use Agent tools or paste URLs)",
        Regex("@folder\\b", RegexOption.IGNORE_CASE) to "#folder:",
        Regex("@file\\s+", RegexOption.IGNORE_CASE) to "#file:",
    )

    fun apply(text: String): String {
        var out = text
        for ((pattern, replacement) in SUBSTITUTIONS) {
            out = pattern.replace(out, replacement)
        }
        return out
    }
}
