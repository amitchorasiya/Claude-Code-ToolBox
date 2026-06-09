package com.amitchorasiya.claude.toolbox.intellij.intelligence

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermission
import kotlin.io.path.exists
import kotlin.io.path.isRegularFile

/**
 * Manages Token Optimization hooks, CLAUDE.md verbosity block, and project map.
 * Writes Python hooks to ~/.claude/ and a verbosity block into workspace CLAUDE.md.
 */
object TokenOptimizationService {

    private val gson = Gson()
    private val home: Path get() = Path.of(System.getProperty("user.home"))
    private val claudeDir: Path get() = home.resolve(".claude")
    private val settingsPath: Path get() = claudeDir.resolve("settings.json")

    private const val READ_DEDUP_SCRIPT = "toolbox-token-opt-read-dedup.py"
    private const val OUTPUT_COMPRESS_SCRIPT = "toolbox-token-opt-output-compress.py"

    private const val READ_DEDUP_MARKER = "# cloude-code-toolbox-token-opt-read-dedup v1"
    private const val OUTPUT_COMPRESS_MARKER = "# cloude-code-toolbox-token-opt-output-compress v1"

    private const val TOKEN_OPT_BANNER_START = "<!-- cloude-code-toolbox:token-optimization-begin -->"
    private const val TOKEN_OPT_BANNER_END = "<!-- cloude-code-toolbox:token-optimization-end -->"

    fun isEnabled(): Boolean {
        val rd = claudeDir.resolve(READ_DEDUP_SCRIPT)
        val oc = claudeDir.resolve(OUTPUT_COMPRESS_SCRIPT)
        return rd.exists() && rd.isRegularFile() &&
            oc.exists() && oc.isRegularFile()
    }

    fun setEnabled(enable: Boolean, workspaceRoot: Path?) {
        if (enable) enable(workspaceRoot) else disable(workspaceRoot)
    }

    fun enable(workspaceRoot: Path?) {
        Files.createDirectories(claudeDir)

        // Write hook scripts
        writeScript(claudeDir.resolve(READ_DEDUP_SCRIPT), renderReadDedupHookScript())
        writeScript(claudeDir.resolve(OUTPUT_COMPRESS_SCRIPT), renderOutputCompressHookScript())

        // Register hooks in settings.json
        registerHooks()

        // Merge verbosity block into CLAUDE.md
        if (workspaceRoot != null) {
            mergeVerbosityBlock(workspaceRoot)
            generateProjectMap(workspaceRoot)
        }
    }

    fun disable(workspaceRoot: Path?) {
        // Remove scripts
        val scripts = listOf(READ_DEDUP_SCRIPT, OUTPUT_COMPRESS_SCRIPT)
        for (name in scripts) {
            val p = claudeDir.resolve(name)
            if (p.exists()) Files.deleteIfExists(p)
        }

        // Remove hook entries
        unregisterHooks()

        // Remove verbosity block from CLAUDE.md
        if (workspaceRoot != null) {
            removeVerbosityBlock(workspaceRoot)
        }
    }

    private fun writeScript(path: Path, content: String) {
        val tmp = path.resolveSibling(path.fileName.toString() + ".tmp")
        Files.writeString(tmp, content, StandardCharsets.UTF_8)
        try {
            val perms = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE,
                PosixFilePermission.GROUP_READ,
                PosixFilePermission.GROUP_EXECUTE,
                PosixFilePermission.OTHERS_READ,
                PosixFilePermission.OTHERS_EXECUTE,
            )
            Files.setPosixFilePermissions(tmp, perms)
        } catch (_: UnsupportedOperationException) {
            // Windows
        }
        Files.move(tmp, path, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
    }

    private fun readSettings(): JsonObject {
        if (!settingsPath.exists()) return JsonObject()
        return try {
            JsonParser.parseString(Files.readString(settingsPath, StandardCharsets.UTF_8)).asJsonObject
        } catch (_: Exception) {
            JsonObject()
        }
    }

    private fun writeSettings(obj: JsonObject) {
        Files.createDirectories(claudeDir)
        val tmp = settingsPath.resolveSibling("settings.json.tmp")
        Files.writeString(tmp, gson.toJson(obj) + "\n", StandardCharsets.UTF_8)
        try {
            val perms = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
            )
            Files.setPosixFilePermissions(tmp, perms)
        } catch (_: UnsupportedOperationException) {
            // Windows
        }
        Files.move(tmp, settingsPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
    }

    private fun registerHooks() {
        val settings = readSettings()
        if (!settings.has("hooks")) {
            settings.add("hooks", JsonObject())
        }
        val hooks = settings.getAsJsonObject("hooks")
        if (!hooks.has("PreToolUse")) {
            hooks.add("PreToolUse", JsonArray())
        }
        val preToolUse = hooks.getAsJsonArray("PreToolUse")

        val scripts = listOf(
            Pair(READ_DEDUP_SCRIPT, READ_DEDUP_MARKER),
            Pair(OUTPUT_COMPRESS_SCRIPT, OUTPUT_COMPRESS_MARKER),
        )

        for ((scriptName, _) in scripts) {
            val command = """python3 "${claudeDir.resolve(scriptName)}""""
            addOrReplaceHookEntry(preToolUse, scriptName, command)
        }

        writeSettings(settings)
    }

    private fun unregisterHooks() {
        if (!settingsPath.exists()) return
        val settings = readSettings()
        val hooks = settings.getAsJsonObject("hooks") ?: return
        val preToolUse = hooks.getAsJsonArray("PreToolUse") ?: return

        val scriptPaths = listOf(READ_DEDUP_SCRIPT, OUTPUT_COMPRESS_SCRIPT)

        val toRemove = mutableListOf<Int>()
        for (i in 0 until preToolUse.size()) {
            val entry = preToolUse[i]
            if (!entry.isJsonObject) continue
            val hooksArr = entry.asJsonObject.getAsJsonArray("hooks") ?: continue
            for (j in 0 until hooksArr.size()) {
                val h = hooksArr[j]
                if (!h.isJsonObject) continue
                val cmd = h.asJsonObject.get("command")?.asString ?: ""
                if (scriptPaths.any { cmd.contains(it) }) {
                    toRemove.add(i)
                    break
                }
            }
        }
        for (i in toRemove.reversed()) {
            preToolUse.remove(i)
        }

        writeSettings(settings)
    }

    private fun addOrReplaceHookEntry(arr: JsonArray, identifier: String, command: String) {
        var existingIdx = -1
        for (i in 0 until arr.size()) {
            val entry = arr[i]
            if (!entry.isJsonObject) continue
            val hooksArr = entry.asJsonObject.getAsJsonArray("hooks") ?: continue
            for (j in 0 until hooksArr.size()) {
                val h = hooksArr[j]
                if (!h.isJsonObject) continue
                val cmd = h.asJsonObject.get("command")?.asString ?: ""
                if (cmd.contains(identifier)) {
                    existingIdx = i
                    break
                }
            }
            if (existingIdx >= 0) break
        }

        val hookObj = JsonObject()
        hookObj.addProperty("type", "command")
        hookObj.addProperty("command", command)
        val hooksArr = JsonArray()
        hooksArr.add(hookObj)
        val entry = JsonObject()
        entry.add("hooks", hooksArr)

        if (existingIdx >= 0) {
            arr.set(existingIdx, entry)
        } else {
            arr.add(entry)
        }
    }

    private fun mergeVerbosityBlock(workspaceRoot: Path) {
        val claudeMd = workspaceRoot.resolve("CLAUDE.md")
        val existing = if (claudeMd.exists()) Files.readString(claudeMd, StandardCharsets.UTF_8) else ""
        val block = buildTokenOptBlock()
        val updated = replaceOrAppendTokenOptBlock(existing, block)
        Files.createDirectories(claudeMd.parent)
        Files.writeString(claudeMd, updated, StandardCharsets.UTF_8)
    }

    private fun removeVerbosityBlock(workspaceRoot: Path) {
        val claudeMd = workspaceRoot.resolve("CLAUDE.md")
        if (!claudeMd.exists()) return
        val existing = Files.readString(claudeMd, StandardCharsets.UTF_8)
        val updated = removeTokenOptBlock(existing)
        Files.writeString(claudeMd, updated, StandardCharsets.UTF_8)
    }

    private fun buildTokenOptBlock(): String {
        val inner = buildTokenOptimizationInstructions()
        return "\n$TOKEN_OPT_BANNER_START\n\n${inner.trim()}\n\n$TOKEN_OPT_BANNER_END\n"
    }

    private fun buildTokenOptimizationInstructions(): String {
        val lines = mutableListOf<String>()
        lines.add("### Token Optimization (Claude Code ToolBox)")
        lines.add("")
        lines.add("_Active level: concise_")
        lines.add("")
        lines.add("- Respond concisely: 1-3 sentences max unless the user asks for detail.")
        lines.add("- Never restate the user's question or echo file contents back verbatim.")
        lines.add("- When showing code changes, show only modified lines with 2 lines of context.")
        lines.add("- Skip meta-commentary (\"I'll now...\", \"Let me...\", \"Here's what I did...\").")
        lines.add("- Before reading a file, check `.claude/project-map.md` for structural context.")
        lines.add("- If you already read a file this session and it hasn't changed, reference your memory instead of re-reading.")
        lines.add("- Do not read files matching `.claudeignore` patterns unless explicitly asked.")
        return lines.joinToString("\n")
    }

    private fun replaceOrAppendTokenOptBlock(existing: String, block: String): String {
        val trimmed = existing.trim()
        if (trimmed.isEmpty()) {
            return "# Claude Code — project context\n$block"
        }
        if (trimmed.contains(TOKEN_OPT_BANNER_START) && trimmed.contains(TOKEN_OPT_BANNER_END)) {
            val re = Regex(
                Regex.escape(TOKEN_OPT_BANNER_START) + "[\\s\\S]*?" + Regex.escape(TOKEN_OPT_BANNER_END) + "\\n*",
                RegexOption.MULTILINE
            )
            return trimmed.replace(re, block)
        }
        return trimmed + block
    }

    private fun removeTokenOptBlock(existing: String): String {
        val trimmed = existing.trim()
        if (!trimmed.contains(TOKEN_OPT_BANNER_START) || !trimmed.contains(TOKEN_OPT_BANNER_END)) {
            return trimmed
        }
        val re = Regex(
            "\\n*" + Regex.escape(TOKEN_OPT_BANNER_START) + "[\\s\\S]*?" + Regex.escape(TOKEN_OPT_BANNER_END) + "\\n*",
            RegexOption.MULTILINE
        )
        return trimmed.replace(re, "\n").replace(Regex("\\n{3,}"), "\n\n").trim()
    }

    private fun generateProjectMap(workspaceRoot: Path) {
        val projectMapDir = workspaceRoot.resolve(".claude")
        Files.createDirectories(projectMapDir)
        val projectMapPath = projectMapDir.resolve("project-map.md")

        val extensions = listOf(".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs", ".kt")
        val maxFiles = 200
        val lines = mutableListOf<String>()
        lines.add("# Project Map")
        lines.add("")
        lines.add("_Auto-generated by Claude Code ToolBox Token Optimization._")
        lines.add("")

        var count = 0
        try {
            Files.walk(workspaceRoot)
                .filter { Files.isRegularFile(it) }
                .filter { path ->
                    val name = path.fileName.toString()
                    extensions.any { name.endsWith(it) }
                }
                .filter { path ->
                    val rel = workspaceRoot.relativize(path).toString()
                    !rel.startsWith("node_modules") &&
                        !rel.startsWith(".git") &&
                        !rel.startsWith("dist") &&
                        !rel.startsWith("build") &&
                        !rel.startsWith("target") &&
                        !rel.contains("/node_modules/")
                }
                .sorted()
                .limit(maxFiles.toLong())
                .forEach { path ->
                    val rel = workspaceRoot.relativize(path).toString()
                    lines.add("- `$rel`")
                    count++
                }
        } catch (_: Exception) {
            // Ignore walk errors
        }

        lines.add("")
        lines.add("_$count files indexed._")

        Files.writeString(projectMapPath, lines.joinToString("\n") + "\n", StandardCharsets.UTF_8)
    }

    // ─── Hook script content ───

    // Helper: Python triple-quote cannot appear literally in Kotlin raw strings
    private const val TQ = "\"\"\""

    private fun renderReadDedupHookScript(): String {
        return """#!/usr/bin/env python3
$READ_DEDUP_MARKER
${TQ}PreToolUse hook: warns on redundant file re-reads within a session.${TQ}
import json, sys, os, time, re

WINDOW_SEC = 120
CACHE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "claude-token-opt")
os.makedirs(CACHE_DIR, mode=0o700, exist_ok=True)

def get_cache_path(session_id):
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', session_id)[:64]
    return os.path.join(CACHE_DIR, f"reads-{safe}.json")

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Read", "View", "read_file", "file_system_read_file"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not file_path:
        sys.exit(0)

    session_id = data.get("session_id", "default")
    cache_path = get_cache_path(session_id)

    records = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path) as f:
                records = json.load(f)
        except Exception:
            records = {}

    now = time.time()
    key = file_path

    if key in records:
        rec = records[key]
        elapsed = now - rec.get("last_read", 0)
        if elapsed < WINDOW_SEC:
            try:
                st = os.stat(file_path)
                if st.st_mtime == rec.get("mtime") and st.st_size == rec.get("size"):
                    count = rec.get("count", 1)
                    print(f"[Token Opt] File unchanged since last read {int(elapsed)}s ago (read {count}x). Consider using cached content.", file=sys.stderr)
            except OSError:
                pass

    try:
        st = os.stat(file_path)
        records[key] = {
            "last_read": now,
            "mtime": st.st_mtime,
            "size": st.st_size,
            "count": records.get(key, {}).get("count", 0) + 1
        }
    except OSError:
        pass

    try:
        fd = os.open(cache_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(records, f)
    except Exception:
        pass

    sys.exit(0)

if __name__ == "__main__":
    main()
"""
    }

    private fun renderOutputCompressHookScript(): String {
        return """#!/usr/bin/env python3
$OUTPUT_COMPRESS_MARKER
${TQ}PostToolUse hook: compresses verbose CLI output to save tokens.${TQ}
import json, sys, os, re
from collections import Counter

MAX_LINES = 200

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Bash", "bash", "execute_command"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    output = tool_input.get("stdout") or tool_input.get("output") or ""
    if not output:
        sys.exit(0)

    lines = output.split("\n")
    if len(lines) <= MAX_LINES:
        sys.exit(0)

    command = tool_input.get("command", "")
    compressed = compress_output(command, lines)
    if compressed:
        print(compressed, file=sys.stderr)

    sys.exit(0)

def compress_output(command, lines):
    total = len(lines)
    normalized = Counter()
    for line in lines:
        key = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}', '<ts>', line.strip())
        key = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}', '<id>', key)
        normalized[key] += 1

    result = []
    seen = set()
    for line in lines[:MAX_LINES]:
        key = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}', '<ts>', line.strip())
        key = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}', '<id>', key)
        count = normalized[key]
        if count > 3 and key in seen:
            continue
        if count > 3:
            result.append(f"{line} (x{count})")
            seen.add(key)
        else:
            result.append(line)

    if total > len(result):
        result.append(f"\n... ({total - len(result)} lines omitted, {total} total)")

    return "[Token Opt] Compressed output:\n" + "\n".join(result)

if __name__ == "__main__":
    main()
"""
    }
}
