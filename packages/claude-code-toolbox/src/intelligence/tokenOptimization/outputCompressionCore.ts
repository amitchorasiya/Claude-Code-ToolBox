/**
 * CLI output compression: command-specific filter rules for reducing token usage.
 * Pure logic — no vscode imports.
 */

export type CompressionConfig = {
  maxLines: number;
  enabledCommands: string[];
};

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxLines: 50,
  enabledCommands: ["git", "npm", "yarn", "pnpm", "jest", "vitest", "pytest", "docker", "kubectl", "ls", "find"],
};

export type CompressionResult = {
  compressed: string;
  originalLines: number;
  compressedLines: number;
  savingsPercent: number;
};

export function compressOutput(
  command: string,
  output: string,
  config: CompressionConfig
): CompressionResult {
  const lines = output.split("\n");
  const originalLines = lines.length;

  if (originalLines <= config.maxLines) {
    return { compressed: output, originalLines, compressedLines: originalLines, savingsPercent: 0 };
  }

  const baseCommand = extractBaseCommand(command);

  let compressed: string;
  switch (baseCommand) {
    case "git":
      compressed = compressGitOutput(command, lines, config.maxLines);
      break;
    case "npm":
    case "yarn":
    case "pnpm":
      compressed = compressNpmOutput(lines, config.maxLines);
      break;
    case "jest":
    case "vitest":
    case "pytest":
      compressed = compressTestOutput(lines, config.maxLines);
      break;
    default:
      compressed = compressGeneric(lines, config.maxLines);
      break;
  }

  const compressedLines = compressed.split("\n").length;
  const savingsPercent = Math.round((1 - compressedLines / originalLines) * 100);
  return { compressed, originalLines, compressedLines, savingsPercent };
}

function extractBaseCommand(command: string): string {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);
  const base = parts[0].split("/").pop() ?? parts[0];
  return base.replace(/\.exe$/i, "");
}

function compressGitOutput(command: string, lines: string[], maxLines: number): string {
  if (command.includes("status")) {
    return compressGitStatus(lines, maxLines);
  }
  if (command.includes("diff")) {
    return compressGitDiff(lines, maxLines);
  }
  if (command.includes("log")) {
    return compressGitLog(lines, maxLines);
  }
  return compressGeneric(lines, maxLines);
}

function compressGitStatus(lines: string[], maxLines: number): string {
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("On branch") || trimmed.startsWith("Your branch")) {
      continue;
    }
    if (trimmed.startsWith("new file:") || trimmed.startsWith("modified:") && line.startsWith("\t")) {
      staged.push(trimmed);
    } else if (trimmed.startsWith("modified:")) {
      modified.push(trimmed);
    } else if (!trimmed.startsWith("(") && !trimmed.startsWith("Changes") && !trimmed.startsWith("Untracked")) {
      untracked.push(trimmed);
    }
  }

  const result: string[] = [];
  if (staged.length > 0) result.push(`Staged (${staged.length}): ${staged.slice(0, 5).join(", ")}${staged.length > 5 ? ` +${staged.length - 5} more` : ""}`);
  if (modified.length > 0) result.push(`Modified (${modified.length}): ${modified.slice(0, 5).join(", ")}${modified.length > 5 ? ` +${modified.length - 5} more` : ""}`);
  if (untracked.length > 0) result.push(`Untracked (${untracked.length}): ${untracked.slice(0, 5).join(", ")}${untracked.length > 5 ? ` +${untracked.length - 5} more` : ""}`);

  return result.length > 0 ? result.join("\n") : "Clean working tree";
}

function compressGitDiff(lines: string[], maxLines: number): string {
  const fileHeaders: string[] = [];
  const result: string[] = [];
  let currentFile = "";
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        fileHeaders.push(`${currentFile}: +${additions} -${deletions}`);
      }
      currentFile = line.replace(/^diff --git a\/\S+ b\//, "");
      additions = 0;
      deletions = 0;
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }
  if (currentFile) {
    fileHeaders.push(`${currentFile}: +${additions} -${deletions}`);
  }

  result.push(`Files changed (${fileHeaders.length}):`);
  for (const h of fileHeaders.slice(0, maxLines - 2)) {
    result.push(`  ${h}`);
  }
  if (fileHeaders.length > maxLines - 2) {
    result.push(`  ... +${fileHeaders.length - (maxLines - 2)} more files`);
  }

  return result.join("\n");
}

function compressGitLog(lines: string[], maxLines: number): string {
  const commits: string[] = [];
  let current = "";

  for (const line of lines) {
    if (line.startsWith("commit ")) {
      if (current) commits.push(current.trim());
      current = line.slice(7, 14) + " ";
    } else if (line.trim() && !line.startsWith("Author:") && !line.startsWith("Date:") && !line.startsWith("Merge:")) {
      current += line.trim() + " ";
    }
  }
  if (current) commits.push(current.trim());

  const result = commits.slice(0, maxLines);
  if (commits.length > maxLines) {
    result.push(`... +${commits.length - maxLines} more commits`);
  }
  return result.join("\n");
}

function compressNpmOutput(lines: string[], maxLines: number): string {
  const warnings: string[] = [];
  const errors: string[] = [];
  const important: string[] = [];

  for (const line of lines) {
    if (line.includes("WARN")) warnings.push(line.trim());
    else if (line.includes("ERR") || line.includes("error")) errors.push(line.trim());
    else if (line.includes("added") || line.includes("removed") || line.includes("up to date") || line.includes("found")) {
      important.push(line.trim());
    }
  }

  const result: string[] = [];
  if (errors.length > 0) {
    result.push(`Errors (${errors.length}):`);
    result.push(...errors.slice(0, 10));
  }
  if (warnings.length > 0) {
    result.push(`Warnings (${warnings.length}): ${warnings.length <= 3 ? warnings.join("; ") : `showing first 3 — ${warnings.slice(0, 3).join("; ")}`}`);
  }
  if (important.length > 0) {
    result.push(...important);
  }

  return result.length > 0 ? result.join("\n") : compressGeneric(lines, maxLines);
}

function compressTestOutput(lines: string[], maxLines: number): string {
  const summaryLines: string[] = [];
  const failures: string[] = [];
  let inFailure = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("pass") || lower.includes("fail") || lower.includes("skip") || lower.includes("total") || lower.includes("suite") || lower.includes("test")) {
      if (lower.includes("fail") && !lower.includes("0 fail")) {
        inFailure = true;
      }
      summaryLines.push(line.trim());
    } else if (inFailure && line.trim()) {
      failures.push(line.trim());
      if (failures.length >= 15) inFailure = false;
    }
  }

  const result: string[] = [];
  const summary = summaryLines.slice(-5);
  if (summary.length > 0) {
    result.push("Summary:");
    result.push(...summary);
  }
  if (failures.length > 0) {
    result.push("");
    result.push("Failures:");
    result.push(...failures.slice(0, maxLines - result.length - 1));
  }

  return result.length > 0 ? result.join("\n") : compressGeneric(lines, maxLines);
}

export function compressGeneric(lines: string[], maxLines: number): string {
  const lineCounts = new Map<string, number>();
  const normalized: string[] = [];

  for (const line of lines) {
    const key = normalizeLine(line);
    lineCounts.set(key, (lineCounts.get(key) || 0) + 1);
    normalized.push(key);
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < lines.length && result.length < maxLines; i++) {
    const key = normalized[i];
    const count = lineCounts.get(key) || 1;
    if (count > 3 && seen.has(key)) {
      continue;
    }
    if (count > 3 && !seen.has(key)) {
      result.push(`${lines[i]} (x${count})`);
      seen.add(key);
    } else {
      result.push(lines[i]);
    }
  }

  if (lines.length > result.length) {
    result.push(`\n... (${lines.length - result.length} lines omitted, ${lines.length} total)`);
  }

  return result.join("\n");
}

function normalizeLine(line: string): string {
  const truncated = line.length > 1000 ? line.slice(0, 1000) : line;
  return truncated
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, "<timestamp>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\d+\.\d+\.\d+\.\d+/g, "<ip>")
    .replace(/:\d{2,5}\b/g, ":<port>")
    .trim();
}
