/**
 * Readiness evaluation from plain file facts (unit-tested, no vscode imports).
 */

export type FileFact = {
  exists: boolean;
  /** UTF-8 byte length when file exists; 0 if missing */
  byteLength: number;
  /** Last modified ms when known */
  mtimeMs?: number;
};

export type ReadinessInput = {
  claudeMd: FileFact;
  /** True when `CLAUDE.md` contains the toolbox block from merging `.github/copilot-instructions.md`. */
  claudeMdHasCopilotMigrateBlock: boolean;
  agentsMd: FileFact;
  claudeRulesFileCount: number;
  memoryBankDirExists: boolean;
  workspaceMcpJson: FileFact;
  cursorrules: FileFact;
  cursorRulesDirHasFiles: boolean;
  copilotInstructionsMd: FileFact;
};

export type ReadinessCheck = {
  id: string;
  ok: boolean;
  message: string;
  suggestedCommand?: string;
};

const EMPTY_THRESHOLD = 12;

function isEffectivelyEmpty(f: FileFact): boolean {
  return f.exists && f.byteLength <= EMPTY_THRESHOLD;
}

export function evaluateReadiness(input: ReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  checks.push({
    id: "claude-md",
    ok: input.claudeMd.exists && !isEffectivelyEmpty(input.claudeMd),
    message: !input.claudeMd.exists
      ? "Missing `CLAUDE.md` at workspace root."
      : isEffectivelyEmpty(input.claudeMd)
        ? "`CLAUDE.md` exists but is nearly empty."
        : "`CLAUDE.md` looks populated.",
    suggestedCommand: !input.claudeMd.exists
      ? "CloudeCodeToolBox.runOneClickSetup"
      : isEffectivelyEmpty(input.claudeMd)
        ? "CloudeCodeToolBox.appendCursorrules"
        : "CloudeCodeToolBox.openInstructionsPicker",
  });

  checks.push({
    id: "claude-rules",
    ok: true,
    message:
      input.claudeRulesFileCount === 0
        ? "No `.claude/rules/*.md` files (optional scoped rules)."
        : `Found ${input.claudeRulesFileCount} markdown file(s) under .claude/rules/.`,
    suggestedCommand: "CloudeCodeToolBox.syncCursorRules",
  });

  checks.push({
    id: "agents-md",
    ok: true,
    message: !input.agentsMd.exists
      ? "No `AGENTS.md` (optional agent-oriented instructions)."
      : isEffectivelyEmpty(input.agentsMd)
        ? "`AGENTS.md` exists but is nearly empty."
        : "`AGENTS.md` looks populated.",
    suggestedCommand: "CloudeCodeToolBox.openInstructionsPicker",
  });

  checks.push({
    id: "memory-bank",
    ok: true,
    message: input.memoryBankDirExists
      ? "`memory-bank/` directory present."
      : "No `memory-bank/` directory (optional long-lived project memory).",
    suggestedCommand: "CloudeCodeToolBox.initMemoryBank",
  });

  checks.push({
    id: "mcp-json",
    ok: input.workspaceMcpJson.exists,
    message: input.workspaceMcpJson.exists
      ? "Workspace `.vscode/mcp.json` present."
      : "Workspace `.vscode/mcp.json` missing.",
    suggestedCommand: "CloudeCodeToolBox.portCursorMcp",
  });

  checks.push({
    id: "cursorrules",
    ok: input.cursorrules.exists || input.cursorRulesDirHasFiles,
    message:
      input.cursorrules.exists || input.cursorRulesDirHasFiles
        ? "Cursor rules (`.cursorrules` and/or `.cursor/rules`) present."
        : "No `.cursorrules` or `.cursor/rules` files detected.",
    suggestedCommand: "CloudeCodeToolBox.createCursorrulesTemplate",
  });

  const copilotLegacy =
    input.copilotInstructionsMd.exists &&
    !isEffectivelyEmpty(input.copilotInstructionsMd) &&
    input.claudeMd.exists;
  checks.push({
    id: "copilot-instructions-legacy",
    ok: !copilotLegacy || input.claudeMdHasCopilotMigrateBlock,
    message: !input.copilotInstructionsMd.exists
      ? "No `.github/copilot-instructions.md` (legacy GitHub Copilot instructions)."
      : isEffectivelyEmpty(input.copilotInstructionsMd)
        ? "`.github/copilot-instructions.md` exists but is nearly empty."
        : input.claudeMdHasCopilotMigrateBlock
          ? "Legacy Copilot instructions appear merged into `CLAUDE.md` (toolbox marker present)."
          : "`.github/copilot-instructions.md` has content but `CLAUDE.md` has no merged Copilot block — run merge or One Click (Copilot track).",
    suggestedCommand: input.claudeMdHasCopilotMigrateBlock
      ? "CloudeCodeToolBox.openInstructionsPicker"
      : "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd",
  });

  checks.push({
    id: "mcp-vs-claude-session",
    ok: true,
    message:
      "VS Code **`.vscode/mcp.json`** powers editor MCP; **Claude Code** uses **`/mcp`** in the Claude panel and may use `~/.claude/settings.json`. Configure both if you use MCP in each surface.",
    suggestedCommand: "CloudeCodeToolBox.openClaudeUserSettingsJson",
  });

  const cr = input.cursorrules;
  const cm = input.claudeMd;
  if (cr.exists && cr.mtimeMs !== undefined && cm.exists && cm.mtimeMs !== undefined) {
    const newer = cr.mtimeMs > cm.mtimeMs;
    checks.push({
      id: "cursorrules-mtime",
      ok: !newer,
      message: newer
        ? "`.cursorrules` is newer than `CLAUDE.md` — consider syncing or appending."
        : "`CLAUDE.md` is at least as new as `.cursorrules` (by modified time).",
      suggestedCommand: "CloudeCodeToolBox.appendCursorrules",
    });
  }

  return checks;
}

export function formatReadinessMarkdown(checks: ReadinessCheck[]): string {
  const lines: string[] = [
    "# Cloude Code ToolBox — Intelligence readiness",
    "",
    "Run commands from the Command Palette (`Cloude Code ToolBox: …`) or the **MCP & skills** hub.",
    "",
  ];
  for (const c of checks) {
    const icon = c.ok ? "✓" : "○";
    lines.push(`## ${icon} ${c.id}`);
    lines.push(c.message);
    if (c.suggestedCommand) {
      lines.push("", `Suggested: \`${c.suggestedCommand}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}
