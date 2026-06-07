/**
 * Pattern matching logic for destructive command detection.
 * Pure functions, no vscode deps.
 */

export interface DestructiveMatch {
  matched: boolean;
  pattern: string;
  explanation: string;
}

export function matchDestructiveCommand(
  command: string,
  patterns: string[],
  allowOverrides: string[]
): DestructiveMatch {
  const normalized = normalizeCommand(command);

  for (const override of allowOverrides) {
    if (normalized.includes(override.toLowerCase())) {
      return { matched: false, pattern: "", explanation: "" };
    }
  }

  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern.includes("|")) {
      if (matchPipePattern(normalized, lowerPattern)) {
        return {
          matched: true,
          pattern,
          explanation: getExplanation(pattern),
        };
      }
      continue;
    }

    if (normalized.includes(lowerPattern)) {
      return {
        matched: true,
        pattern,
        explanation: getExplanation(pattern),
      };
    }
  }

  return { matched: false, pattern: "", explanation: "" };
}

function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*/g, "|")
    .toLowerCase()
    .trim();
}

function matchPipePattern(normalized: string, pattern: string): boolean {
  const parts = pattern.split("|");
  if (parts.length !== 2) return false;
  const [left, right] = parts;
  const pipeIdx = normalized.indexOf("|");
  if (pipeIdx === -1) return false;
  const cmdLeft = normalized.slice(0, pipeIdx);
  const cmdRight = normalized.slice(pipeIdx + 1);
  return cmdLeft.includes(left.trim()) && cmdRight.includes(right.trim());
}

function getExplanation(pattern: string): string {
  const explanations: Record<string, string> = {
    "rm -rf": "Recursively removes files/directories without confirmation",
    "rm -fr": "Recursively removes files/directories without confirmation",
    "rm -r /": "Removes from root directory — catastrophic data loss",
    "git push --force": "Force-pushes to remote — can overwrite others' work",
    "git push -f": "Force-pushes to remote — can overwrite others' work",
    "git reset --hard": "Discards all uncommitted changes permanently",
    "git branch -D": "Force-deletes a branch without merge check",
    "git checkout -- .": "Discards all working tree changes",
    "git checkout .": "Discards all working tree changes",
    "git restore .": "Discards all working tree changes",
    "git clean -f": "Removes untracked files permanently",
    "git clean -fd": "Removes untracked files and directories permanently",
    "git clean -fdx": "Removes untracked and ignored files permanently",
    "DROP TABLE": "Permanently destroys a database table and its data",
    "DROP DATABASE": "Permanently destroys an entire database",
    "DROP SCHEMA": "Permanently destroys a database schema",
    "TRUNCATE TABLE": "Deletes all rows from a table without logging",
    "TRUNCATE": "Deletes all rows from a table without logging",
    "DELETE FROM": "Deletes rows — dangerous without WHERE clause",
    "curl|sh": "Pipes remote code directly to shell — arbitrary code execution",
    "curl|bash": "Pipes remote code directly to shell — arbitrary code execution",
    "wget|sh": "Pipes remote code directly to shell — arbitrary code execution",
    "wget|bash": "Pipes remote code directly to shell — arbitrary code execution",
    "chmod 777": "Makes files world-readable/writable/executable",
    "chmod -R 777": "Recursively makes everything world-accessible",
    "mkfs": "Formats a filesystem — destroys all data on device",
    "dd if=": "Raw disk write — can destroy partitions",
    "> /dev/sda": "Overwrites disk device directly",
    ":(){ :|:& };:": "Fork bomb — crashes the system",
    "kill -9 1": "Kills init/systemd — system crash",
    "killall": "Kills all processes matching a name",
    "pkill -9": "Force-kills processes — may corrupt data",
    "npm publish": "Publishes package to public registry",
    "npx rimraf /": "Removes from root directory",
  };
  return explanations[pattern] || `Matches destructive pattern: ${pattern}`;
}
