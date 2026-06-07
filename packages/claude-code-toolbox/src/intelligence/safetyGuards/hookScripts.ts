/**
 * Renders Python hook scripts for Safety Guards.
 * Scripts are pure Python 3, no third-party deps.
 * Destructive command hook exits 2 (block) or 0 (warn).
 * Domain whitelist hook exits 2 (block) or 0 (warn).
 */

export const DESTRUCTIVE_CMD_MARKER = "# cloude-code-toolbox-safety-guard-destructive v1";
export const DOMAIN_WHITELIST_MARKER = "# cloude-code-toolbox-safety-guard-domain v1";

export function renderDestructiveCommandHookScript(
  patterns: string[],
  allowOverrides: string[],
  mode: "block" | "warn"
): string {
  const patternsJson = JSON.stringify(patterns);
  const overridesJson = JSON.stringify(allowOverrides);
  const exitCode = mode === "block" ? 2 : 0;

  return `#!/usr/bin/env python3
${DESTRUCTIVE_CMD_MARKER}
"""PreToolUse hook: detects destructive commands and blocks or warns."""
import json, sys, re

PATTERNS = ${patternsJson}
ALLOW_OVERRIDES = ${overridesJson}
MODE = "${mode}"
EXIT_CODE = ${exitCode}

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
    if matched:
        msg = f"[Safety Guard] BLOCKED destructive command matching pattern: {matched}"
        if MODE == "warn":
            msg = f"[Safety Guard] WARNING destructive command matching pattern: {matched}"
        print(msg, file=sys.stderr)
        sys.exit(EXIT_CODE)

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
"""PreToolUse hook: enforces domain allowlist/blocklist for web requests."""
import json, sys, re
from urllib.parse import urlparse

MODE = "${mode}"
ALLOWED_DOMAINS = ${allowedJson}
BLOCKED_DOMAINS = ${blockedJson}

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
    if not allowed:
        domain = extract_domain(url)
        if MODE == "allowlist":
            print(f"[Safety Guard] BLOCKED domain not in allowlist: {domain}", file=sys.stderr)
        else:
            print(f"[Safety Guard] BLOCKED domain in blocklist: {domain} (matched: {detail})", file=sys.stderr)
        sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()
`;
}
