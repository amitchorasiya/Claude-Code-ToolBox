/**
 * Renders Python hook scripts for Token Optimization.
 * Scripts are pure Python 3, no third-party deps, always exit 0.
 */

export const READ_DEDUP_MARKER = "# cloude-code-toolbox-token-opt-read-dedup v1";
export const CLAUDEIGNORE_MARKER = "# cloude-code-toolbox-token-opt-claudeignore v1";
export const OUTPUT_COMPRESS_MARKER = "# cloude-code-toolbox-token-opt-output-compress v1";

export function renderReadDedupHookScript(windowMs: number): string {
  const windowSec = Math.max(1, Math.min(Math.round(windowMs / 1000), 86400));
  return `#!/usr/bin/env python3
${READ_DEDUP_MARKER}
"""PreToolUse hook: warns on redundant file re-reads within a session."""
import json, sys, os, time, re

WINDOW_SEC = ${windowSec}
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
`;
}

export function renderClaudeIgnoreHookScript(workspacePath: string): string {
  return `#!/usr/bin/env python3
${CLAUDEIGNORE_MARKER}
"""PreToolUse hook: warns when reading files matching .claudeignore patterns."""
import json, sys, os, fnmatch

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Read", "View", "read_file", "file_system_read_file"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not file_path:
        sys.exit(0)

    cwd = data.get("cwd", "") or os.getcwd()
    ignore_file = os.path.join(cwd, ".claudeignore")
    if not os.path.exists(ignore_file):
        sys.exit(0)

    try:
        with open(ignore_file) as f:
            patterns = [
                line.strip() for line in f
                if line.strip() and not line.strip().startswith("#") and len(line.strip()) <= 500
            ][:200]
    except Exception:
        sys.exit(0)

    rel_path = file_path
    if os.path.isabs(file_path) and cwd:
        try:
            rel_path = os.path.relpath(file_path, cwd)
        except ValueError:
            pass

    normalized = rel_path.replace(os.sep, "/")

    for pattern in patterns:
        clean = pattern.replace("**/", "")
        if fnmatch.fnmatch(normalized, pattern) or fnmatch.fnmatch(normalized, clean) or fnmatch.fnmatch(os.path.basename(normalized), clean):
            print(f"[Token Opt] File matches .claudeignore pattern '{pattern}'. Consider skipping unless explicitly needed.", file=sys.stderr)
            break

    sys.exit(0)

if __name__ == "__main__":
    main()
`;
}

export function renderOutputCompressHookScript(maxLines: number): string {
  const safeMaxLines = Math.max(10, Math.min(Math.round(maxLines), 10000));
  return `#!/usr/bin/env python3
${OUTPUT_COMPRESS_MARKER}
"""PostToolUse hook: compresses verbose CLI output to save tokens."""
import json, sys, os, re
from collections import Counter

MAX_LINES = ${safeMaxLines}

def main():
    data = json.loads(sys.stdin.read() or "{}")
    tool = data.get("tool_name", "")
    if tool not in ("Bash", "bash", "execute_command"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    output = tool_input.get("stdout") or tool_input.get("output") or ""
    if not output:
        sys.exit(0)

    lines = output.split("\\n")
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
        key = re.sub(r'\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}', '<ts>', line.strip())
        key = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}', '<id>', key)
        normalized[key] += 1

    result = []
    seen = set()
    for line in lines[:MAX_LINES]:
        key = re.sub(r'\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}', '<ts>', line.strip())
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
        result.append(f"\\n... ({total - len(result)} lines omitted, {total} total)")

    return "[Token Opt] Compressed output:\\n" + "\\n".join(result)

if __name__ == "__main__":
    main()
`;
}
