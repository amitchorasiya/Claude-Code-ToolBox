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
 * Manages AntiVibe Safety Guards hook scripts for Claude Code.
 * Writes Python hook scripts to ~/.claude/ and registers them in ~/.claude/settings.json
 * under hooks.PreToolUse.
 */
object SafetyGuardsService {

    private val gson = Gson()
    private val home: Path get() = Path.of(System.getProperty("user.home"))
    private val claudeDir: Path get() = home.resolve(".claude")
    private val settingsPath: Path get() = claudeDir.resolve("settings.json")

    private const val DESTRUCTIVE_SCRIPT = "safety-guard-destructive.py"
    private const val DOMAIN_SCRIPT = "safety-guard-domain.py"
    private const val SUPPLY_CHAIN_SCRIPT = "safety-guard-supplychain.py"

    private const val DESTRUCTIVE_MARKER = "# cloude-code-toolbox-safety-guard-destructive v1"
    private const val DOMAIN_MARKER = "# cloude-code-toolbox-safety-guard-domain v1"
    private const val SUPPLY_CHAIN_MARKER = "# cloude-code-toolbox-safety-guard-supplychain v1"

    fun isEnabled(): Boolean {
        val d = claudeDir.resolve(DESTRUCTIVE_SCRIPT)
        val dm = claudeDir.resolve(DOMAIN_SCRIPT)
        val sc = claudeDir.resolve(SUPPLY_CHAIN_SCRIPT)
        return d.exists() && d.isRegularFile() &&
            dm.exists() && dm.isRegularFile() &&
            sc.exists() && sc.isRegularFile()
    }

    fun setEnabled(enable: Boolean) {
        if (enable) enable() else disable()
    }

    fun enable() {
        Files.createDirectories(claudeDir)

        // Write scripts
        writeScript(claudeDir.resolve(DESTRUCTIVE_SCRIPT), renderDestructiveCommandHookScript())
        writeScript(claudeDir.resolve(DOMAIN_SCRIPT), renderDomainWhitelistHookScript())
        writeScript(claudeDir.resolve(SUPPLY_CHAIN_SCRIPT), renderSupplyChainHookScript())

        // Register in settings.json
        registerHooks()
    }

    fun disable() {
        // Remove scripts
        val scripts = listOf(DESTRUCTIVE_SCRIPT, DOMAIN_SCRIPT, SUPPLY_CHAIN_SCRIPT)
        for (name in scripts) {
            val p = claudeDir.resolve(name)
            if (p.exists()) Files.deleteIfExists(p)
        }

        // Remove hook entries from settings.json
        unregisterHooks()
    }

    data class StatusInfo(
        val enabled: Boolean,
        val destructiveScript: Boolean,
        val domainScript: Boolean,
        val supplyChainScript: Boolean,
    )

    fun status(): StatusInfo {
        return StatusInfo(
            enabled = isEnabled(),
            destructiveScript = claudeDir.resolve(DESTRUCTIVE_SCRIPT).exists(),
            domainScript = claudeDir.resolve(DOMAIN_SCRIPT).exists(),
            supplyChainScript = claudeDir.resolve(SUPPLY_CHAIN_SCRIPT).exists(),
        )
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
            // Windows — skip POSIX perms
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
            Triple(DESTRUCTIVE_SCRIPT, DESTRUCTIVE_MARKER, "AntiVibe Safety Guard — destructive commands"),
            Triple(DOMAIN_SCRIPT, DOMAIN_MARKER, "AntiVibe Safety Guard — domain whitelist"),
            Triple(SUPPLY_CHAIN_SCRIPT, SUPPLY_CHAIN_MARKER, "AntiVibe Safety Guard — supply chain"),
        )

        for ((scriptName, _, _) in scripts) {
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

        val toRemove = mutableListOf<Int>()
        for (i in 0 until preToolUse.size()) {
            val entry = preToolUse[i]
            if (!entry.isJsonObject) continue
            val hooksArr = entry.asJsonObject.getAsJsonArray("hooks") ?: continue
            for (j in 0 until hooksArr.size()) {
                val h = hooksArr[j]
                if (!h.isJsonObject) continue
                val cmd = h.asJsonObject.get("command")?.asString ?: ""
                if (cmd.contains("safety-guard-")) {
                    toRemove.add(i)
                    break
                }
            }
        }
        for (i in toRemove.reversed()) {
            preToolUse.remove(i)
        }
        if (preToolUse.size() == 0) {
            hooks.remove("PreToolUse")
        }

        // Remove metadata
        settings.remove("safetyGuards")

        writeSettings(settings)
    }

    private fun addOrReplaceHookEntry(arr: JsonArray, identifier: String, command: String) {
        // VS Code format: each entry is { hooks: [{ type: "command", command: "..." }] }
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

    // ─── Script content (exact Python from VS Code extension) ───

    // Helper: Python triple-quote cannot appear literally in Kotlin raw strings
    private const val TQ = "\"\"\""

    private fun renderDestructiveCommandHookScript(): String {
        val patterns = listOf(
            "rm -rf", "rm -fr", "rm -r /", "rmdir /s", "del /f /s /q",
            "git push --force", "git push -f", "git reset --hard",
            "git branch -D", "git branch -d -f", "git checkout -- .",
            "git checkout .", "git restore .", "git clean -f",
            "git clean -fd", "git clean -fdx",
            "DROP TABLE", "DROP DATABASE", "DROP SCHEMA",
            "TRUNCATE TABLE", "TRUNCATE", "DELETE FROM",
            "curl|sh", "curl|bash", "wget|sh", "wget|bash",
            "chmod 777", "chmod -R 777", "mkfs", "dd if=",
            "> /dev/sda", ":(){ :|:& };:", "kill -9 1",
            "killall", "pkill -9", "npm publish", "npx rimraf /",
        )
        val patternsJson = gson.toJson(patterns)
        val overridesJson = "[]"

        return """#!/usr/bin/env python3
$DESTRUCTIVE_MARKER
${TQ}PreToolUse hook: detects destructive commands.
Triple-confirmation: warns twice, blocks on 3rd attempt per pattern per session.
State stored in a temp file scoped to the session (CLAUDE_SESSION_ID or fallback PID).
Cross-platform: works on macOS, Linux, Windows.${TQ}
import json, sys, re, os, tempfile, hashlib, time

PATTERNS = $patternsJson
ALLOW_OVERRIDES = $overridesJson
MODE = "block"
MAX_WARNINGS = 2

def get_state_file():
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    if not session_id:
        session_id = f"pid-{os.getppid()}"
    state_dir = os.path.join(tempfile.gettempdir(), "cloude-toolbox-safety-guards")
    os.makedirs(state_dir, exist_ok=True)
    safe_name = hashlib.sha256(session_id.encode()).hexdigest()[:16]
    return os.path.join(state_dir, f"destructive-{safe_name}.json")

def load_state():
    path = get_state_file()
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if time.time() - data.get("ts", 0) > 3600:
            return {}
        return data.get("attempts", {})
    except Exception:
        return {}

def save_state(attempts):
    path = get_state_file()
    with open(path, "w") as f:
        json.dump({"ts": time.time(), "attempts": attempts}, f)

def normalize(cmd):
    cmd = re.sub(r'\s+', ' ', cmd).strip().lower()
    cmd = re.sub(r'\s*\|\s*', '|', cmd)
    return cmd

def match_pipe_pattern(normalized, pattern):
    parts = pattern.split('|')
    if len(parts) != 2:
        return False
    left, right = parts
    pipe_idx = normalized.find('|')
    if pipe_idx == -1:
        return False
    cmd_left = normalized[:pipe_idx]
    cmd_right = normalized[pipe_idx + 1:]
    return left.strip() in cmd_left and right.strip() in cmd_right

def check_command(command):
    normalized = normalize(command)

    for override in ALLOW_OVERRIDES:
        if override.lower() in normalized:
            return None

    for pattern in PATTERNS:
        lp = pattern.lower()
        if '|' in lp:
            if match_pipe_pattern(normalized, lp):
                return pattern
        elif lp in normalized:
            return pattern

    return None

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Bash", "bash", "execute_command", "shell"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    command = tool_input.get("command", "") or tool_input.get("input", "")
    if not command:
        sys.exit(0)

    matched = check_command(command)
    if not matched:
        sys.exit(0)

    if MODE == "warn":
        print(f"[AntiVibe Safety Guard] WARNING destructive command matching pattern: {matched}", file=sys.stderr)
        sys.exit(0)

    # Triple confirmation: block first 2 attempts, allow on 3rd (user confirmed intent)
    attempts = load_state()
    key = matched.lower()
    count = attempts.get(key, 0) + 1
    attempts[key] = count
    save_state(attempts)

    if count == 1:
        print(f"[AntiVibe Safety Guard] ⚠️  DESTRUCTIVE COMMAND BLOCKED (attempt 1/3): pattern \"{matched}\"", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] This command matches a dangerous pattern and has been blocked.", file=sys.stderr)
        sys.exit(2)
    elif count == 2:
        print(f"[AntiVibe Safety Guard] ⚠️  BLOCKED again (attempt 2/3): pattern \"{matched}\"", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] ASK THE USER: \"Do you want to run this command? It matches destructive pattern '{matched}'.\". If they confirm, retry once more.", file=sys.stderr)
        sys.exit(2)
    else:
        print(f"[AntiVibe Safety Guard] ✅ User confirmed. Allowing destructive command. Pattern: \"{matched}\"", file=sys.stderr)
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
"""
    }

    private fun renderDomainWhitelistHookScript(): String {
        val allowedDomains = listOf(
            "github.com", "*.github.com", "raw.githubusercontent.com", "api.github.com",
            "stackoverflow.com", "*.stackoverflow.com", "npmjs.com", "*.npmjs.com",
            "registry.npmjs.org", "pypi.org", "*.pypi.org", "developer.mozilla.org",
            "*.readthedocs.io", "docs.rs", "pkg.go.dev", "crates.io", "rubygems.org",
            "maven.org", "*.maven.org", "docs.python.org", "nodejs.org",
            "typescriptlang.org", "*.typescriptlang.org", "react.dev", "vuejs.org",
            "angular.io", "nextjs.org", "vercel.com", "*.cloudflare.com",
            "wikipedia.org", "*.wikipedia.org", "arxiv.org", "*.google.com",
            "*.microsoft.com", "learn.microsoft.com", "*.amazonaws.com", "docs.aws.amazon.com",
        )
        val blockedDomains = listOf(
            "pastebin.com", "*.paste.ee", "hastebin.com", "transfer.sh", "file.io",
        )
        val allowedJson = gson.toJson(allowedDomains)
        val blockedJson = gson.toJson(blockedDomains)

        return """#!/usr/bin/env python3
$DOMAIN_MARKER
${TQ}PreToolUse hook: enforces domain allowlist/blocklist for web requests.
Triple-confirmation: blocks twice, allows on 3rd attempt per domain per session.${TQ}
import json, sys, re, os, tempfile, hashlib, time
from urllib.parse import urlparse

MODE = "allowlist"
ALLOWED_DOMAINS = $allowedJson
BLOCKED_DOMAINS = $blockedJson
MAX_WARNINGS = 2

def get_state_file():
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    if not session_id:
        session_id = f"pid-{os.getppid()}"
    state_dir = os.path.join(tempfile.gettempdir(), "cloude-toolbox-safety-guards")
    os.makedirs(state_dir, exist_ok=True)
    safe_name = hashlib.sha256(session_id.encode()).hexdigest()[:16]
    return os.path.join(state_dir, f"domain-{safe_name}.json")

def load_state():
    path = get_state_file()
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if time.time() - data.get("ts", 0) > 3600:
            return {}
        return data.get("attempts", {})
    except Exception:
        return {}

def save_state(attempts):
    path = get_state_file()
    with open(path, "w") as f:
        json.dump({"ts": time.time(), "attempts": attempts}, f)

def extract_domain(url):
    try:
        normalized = url.strip()
        if not re.match(r'^https?://', normalized, re.I):
            normalized = 'https://' + normalized
        parsed = urlparse(normalized)
        return parsed.hostname.lower() if parsed.hostname else ""
    except Exception:
        m = re.match(r'(?:https?://)?([^/:?\s#]+)', url, re.I)
        return m.group(1).lower() if m else ""

def match_domain_pattern(domain, pattern):
    domain = domain.lower()
    pattern = pattern.lower()
    if pattern.startswith("*."):
        suffix = pattern[2:]
        return domain == suffix or domain.endswith("." + suffix)
    return domain == pattern

def check_domain(url):
    domain = extract_domain(url)
    if not domain:
        return True, ""

    if MODE == "allowlist":
        for pattern in ALLOWED_DOMAINS:
            if match_domain_pattern(domain, pattern):
                return True, pattern
        return False, domain
    else:
        for pattern in BLOCKED_DOMAINS:
            if match_domain_pattern(domain, pattern):
                return False, pattern
        return True, ""

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("WebFetch", "web_fetch", "fetch_url", "http_request", "WebSearch", "web_search"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    url = tool_input.get("url", "") or tool_input.get("query", "") or tool_input.get("URL", "")
    if not url:
        sys.exit(0)

    allowed, detail = check_domain(url)
    if allowed:
        sys.exit(0)

    domain = extract_domain(url)
    attempts = load_state()
    key = domain.lower()
    count = attempts.get(key, 0) + 1
    attempts[key] = count
    save_state(attempts)

    if count == 1:
        if MODE == "allowlist":
            print(f"[AntiVibe Safety Guard] ⚠️  BLOCKED domain not in allowlist: {domain} (attempt 1/3)", file=sys.stderr)
        else:
            print(f"[AntiVibe Safety Guard] ⚠️  BLOCKED domain in blocklist: {domain} (attempt 1/3, matched: {detail})", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] This domain is not permitted.", file=sys.stderr)
        sys.exit(2)
    elif count == 2:
        print(f"[AntiVibe Safety Guard] ⚠️  BLOCKED again (attempt 2/3): {domain}", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] ASK THE USER: \"Do you want to allow requests to '{domain}'? It is not in the approved domain list.\". If they confirm, retry once more.", file=sys.stderr)
        sys.exit(2)
    else:
        print(f"[AntiVibe Safety Guard] ✅ User confirmed. Allowing domain: {domain}", file=sys.stderr)
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
"""
    }

    private fun renderSupplyChainHookScript(): String {
        val blockedPackages = listOf(
            "event-stream", "ua-parser-js", "colors", "faker",
            "node-ipc", "peacenotwar", "es5-ext",
        )
        val blockedJson = gson.toJson(blockedPackages)

        return """#!/usr/bin/env python3
$SUPPLY_CHAIN_MARKER
${TQ}PreToolUse hook: blocks installation of known-compromised packages (supply chain guard).
Triple-confirmation: blocks twice, allows on 3rd attempt per package per session.
Intercepts npm install, pip install, yarn add, etc. and checks against a blocklist.
Cross-platform: works on macOS, Linux, Windows.${TQ}
import json, sys, re, os, tempfile, hashlib, time

BLOCKED_PACKAGES = $blockedJson
MODE = "block"
MAX_WARNINGS = 2

INSTALL_PATTERNS = [
    r'\bnpm\s+(?:install|i|add)\b',
    r'\byarn\s+add\b',
    r'\bpnpm\s+(?:add|install)\b',
    r'\bbun\s+(?:add|install)\b',
    r'\bpip3?\s+install\b',
    r'\bgem\s+install\b',
    r'\bcargo\s+add\b',
]

def get_state_file():
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    if not session_id:
        session_id = f"pid-{os.getppid()}"
    state_dir = os.path.join(tempfile.gettempdir(), "cloude-toolbox-safety-guards")
    os.makedirs(state_dir, exist_ok=True)
    safe_name = hashlib.sha256(session_id.encode()).hexdigest()[:16]
    return os.path.join(state_dir, f"supplychain-{safe_name}.json")

def load_state():
    path = get_state_file()
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if time.time() - data.get("ts", 0) > 3600:
            return {}
        return data.get("attempts", {})
    except Exception:
        return {}

def save_state(attempts):
    path = get_state_file()
    with open(path, "w") as f:
        json.dump({"ts": time.time(), "attempts": attempts}, f)

def extract_packages(command):
    ${TQ}Extract package names from an install command.${TQ}
    packages = []
    parts = command.split()
    skip_next = False
    past_command = False
    for i, part in enumerate(parts):
        if skip_next:
            skip_next = False
            continue
        if not past_command:
            if part in ("install", "i", "add"):
                past_command = True
            continue
        if part.startswith("-"):
            if part in ("--registry", "--save-prefix", "-g", "--global", "--save", "--save-dev", "-D", "-S", "-E", "--save-exact", "--save-optional", "-O"):
                if not part.startswith("--") or "=" not in part:
                    skip_next = True
            continue
        pkg = re.split(r'@(?!.*?/)', part)[0] if '@' in part and not part.startswith('@') else part
        if part.startswith('@') and '/' in part:
            pkg = re.split(r'@(?=[0-9^~<>=])', part)[0]
        if pkg:
            packages.append(pkg.lower())
    return packages

def is_install_command(command):
    for pattern in INSTALL_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True
    return False

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Bash", "bash", "execute_command", "shell"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    command = tool_input.get("command", "") or tool_input.get("input", "")
    if not command:
        sys.exit(0)

    if not is_install_command(command):
        sys.exit(0)

    packages = extract_packages(command)
    blocked_found = []
    for pkg in packages:
        for blocked in BLOCKED_PACKAGES:
            if pkg == blocked.lower():
                blocked_found.append(pkg)
                break

    if not blocked_found:
        sys.exit(0)

    names = ", ".join(blocked_found)
    if MODE == "warn":
        print(f"[AntiVibe Supply Chain Guard] WARNING: blocked package(s) detected: {names}", file=sys.stderr)
        print("[AntiVibe Supply Chain Guard] These packages have known supply chain vulnerabilities.", file=sys.stderr)
        sys.exit(0)

    attempts = load_state()
    key = names.lower()
    count = attempts.get(key, 0) + 1
    attempts[key] = count
    save_state(attempts)

    if count == 1:
        print(f"[AntiVibe Supply Chain Guard] ⚠️  BLOCKED package(s) on supply chain blocklist: {names} (attempt 1/3)", file=sys.stderr)
        print(f"[AntiVibe Supply Chain Guard] These packages have known supply chain attacks (compromised, sabotaged, or protestware).", file=sys.stderr)
        sys.exit(2)
    elif count == 2:
        print(f"[AntiVibe Supply Chain Guard] ⚠️  BLOCKED again (attempt 2/3): {names}", file=sys.stderr)
        print(f"[AntiVibe Supply Chain Guard] ASK THE USER: \"Do you want to install '{names}'? These packages are on the supply chain blocklist due to known compromises.\". If they confirm, retry once more.", file=sys.stderr)
        sys.exit(2)
    else:
        print(f"[AntiVibe Supply Chain Guard] ✅ User confirmed. Allowing install: {names}", file=sys.stderr)
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
"""
    }
}
