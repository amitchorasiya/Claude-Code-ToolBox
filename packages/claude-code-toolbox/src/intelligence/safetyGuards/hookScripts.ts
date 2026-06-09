/**
 * Renders Python hook scripts for AntiVibe Safety Guards.
 * Scripts are pure Python 3, no third-party deps.
 * Destructive command hook exits 2 (block) or 0 (warn).
 * Domain whitelist hook exits 2 (block) or 0 (warn).
 * Supply chain hook exits 2 (block) or 0 (warn).
 */

export const DESTRUCTIVE_CMD_MARKER = "# cloude-code-toolbox-safety-guard-destructive v1";
export const DOMAIN_WHITELIST_MARKER = "# cloude-code-toolbox-safety-guard-domain v1";
export const SUPPLY_CHAIN_MARKER = "# cloude-code-toolbox-safety-guard-supplychain v1";

export function renderDestructiveCommandHookScript(
  patterns: string[],
  allowOverrides: string[],
  mode: "block" | "warn"
): string {
  const patternsJson = JSON.stringify(patterns);
  const overridesJson = JSON.stringify(allowOverrides);

  return `#!/usr/bin/env python3
${DESTRUCTIVE_CMD_MARKER}
"""PreToolUse hook: detects destructive commands.
Triple-confirmation: warns twice, blocks on 3rd attempt per pattern per session.
State stored in a temp file scoped to the session (CLAUDE_SESSION_ID or fallback PID).
Cross-platform: works on macOS, Linux, Windows."""
import json, sys, re, os, tempfile, hashlib, time

PATTERNS = ${patternsJson}
ALLOW_OVERRIDES = ${overridesJson}
MODE = "${mode}"
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
    cmd = re.sub(r'\\s+', ' ', cmd).strip().lower()
    cmd = re.sub(r'\\s*\\|\\s*', '|', cmd)
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

    if count < MAX_WARNINGS + 1:
        remaining = MAX_WARNINGS + 1 - count
        print(f"[AntiVibe Safety Guard] \\u26a0\\ufe0f  DESTRUCTIVE COMMAND DETECTED (attempt {count}/3): pattern \\"{matched}\\"", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] This command is blocked for safety. Claude must retry {remaining} more time(s) to confirm intent.", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] If this is intentional, keep retrying. After 3 total attempts it will be allowed.", file=sys.stderr)
        sys.exit(2)
    else:
        # 3rd attempt — user has confirmed intent, allow through
        print(f"[AntiVibe Safety Guard] \\u2705 Allowed after 3 confirmations. Pattern: \\"{matched}\\"", file=sys.stderr)
        # Reset counter so next occurrence of same pattern requires re-confirmation
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
`;
}

export function renderDomainWhitelistHookScript(
  mode: "allowlist" | "blocklist",
  allowedDomains: string[],
  blockedDomains: string[]
): string {
  const allowedJson = JSON.stringify(allowedDomains);
  const blockedJson = JSON.stringify(blockedDomains);

  return `#!/usr/bin/env python3
${DOMAIN_WHITELIST_MARKER}
"""PreToolUse hook: enforces domain allowlist/blocklist for web requests.
Triple-confirmation: blocks twice, allows on 3rd attempt per domain per session."""
import json, sys, re, os, tempfile, hashlib, time
from urllib.parse import urlparse

MODE = "${mode}"
ALLOWED_DOMAINS = ${allowedJson}
BLOCKED_DOMAINS = ${blockedJson}
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
        m = re.match(r'(?:https?://)?([^/:?\\s#]+)', url, re.I)
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

    if count < MAX_WARNINGS + 1:
        remaining = MAX_WARNINGS + 1 - count
        if MODE == "allowlist":
            print(f"[AntiVibe Safety Guard] \\u26a0\\ufe0f  BLOCKED domain not in allowlist: {domain} (attempt {count}/3)", file=sys.stderr)
        else:
            print(f"[AntiVibe Safety Guard] \\u26a0\\ufe0f  BLOCKED domain in blocklist: {domain} (attempt {count}/3, matched: {detail})", file=sys.stderr)
        print(f"[AntiVibe Safety Guard] Retry {remaining} more time(s) to confirm this domain is intentional.", file=sys.stderr)
        sys.exit(2)
    else:
        print(f"[AntiVibe Safety Guard] \\u2705 Allowed domain after 3 confirmations: {domain}", file=sys.stderr)
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
`;
}

export function renderSupplyChainHookScript(
  blockedPackages: string[],
  mode: "block" | "warn"
): string {
  const blockedJson = JSON.stringify(blockedPackages);

  return `#!/usr/bin/env python3
${SUPPLY_CHAIN_MARKER}
"""PreToolUse hook: blocks installation of known-compromised packages (supply chain guard).
Triple-confirmation: blocks twice, allows on 3rd attempt per package per session.
Intercepts npm install, pip install, yarn add, etc. and checks against a blocklist.
Cross-platform: works on macOS, Linux, Windows."""
import json, sys, re, os, tempfile, hashlib, time

BLOCKED_PACKAGES = ${blockedJson}
MODE = "${mode}"
MAX_WARNINGS = 2

INSTALL_PATTERNS = [
    r'\\bnpm\\s+(?:install|i|add)\\b',
    r'\\byarn\\s+add\\b',
    r'\\bpnpm\\s+(?:add|install)\\b',
    r'\\bbun\\s+(?:add|install)\\b',
    r'\\bpip3?\\s+install\\b',
    r'\\bgem\\s+install\\b',
    r'\\bcargo\\s+add\\b',
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
    """Extract package names from an install command."""
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

    if count < MAX_WARNINGS + 1:
        remaining = MAX_WARNINGS + 1 - count
        print(f"[AntiVibe Supply Chain Guard] \\u26a0\\ufe0f  BLOCKED package(s) on supply chain blocklist: {names} (attempt {count}/3)", file=sys.stderr)
        print(f"[AntiVibe Supply Chain Guard] These packages have known supply chain attacks (compromised, sabotaged, or protestware).", file=sys.stderr)
        print(f"[AntiVibe Supply Chain Guard] Retry {remaining} more time(s) to confirm this install is intentional.", file=sys.stderr)
        sys.exit(2)
    else:
        print(f"[AntiVibe Supply Chain Guard] \\u2705 Allowed after 3 confirmations: {names}", file=sys.stderr)
        attempts[key] = 0
        save_state(attempts)
        sys.exit(0)

if __name__ == "__main__":
    main()
`;
}
