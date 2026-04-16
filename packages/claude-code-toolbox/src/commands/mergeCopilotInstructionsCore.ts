/** Pure merge helpers: `.github/copilot-instructions.md` → `CLAUDE.md` replaceable block. */

export const COPILOT_INSTRUCTIONS_MIGRATE_BEGIN =
  "<!-- cloude-code-toolbox:copilot-instructions-begin -->";
export const COPILOT_INSTRUCTIONS_MIGRATE_END =
  "<!-- cloude-code-toolbox:copilot-instructions-end -->";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCopilotInstructionsMigrateBlock(copilotInstructionsBody: string): string {
  const body = copilotInstructionsBody.trim();
  return [
    "",
    COPILOT_INSTRUCTIONS_MIGRATE_BEGIN,
    "",
    "## Migrated from `.github/copilot-instructions.md` (via Cloude Code ToolBox)",
    "",
    body,
    "",
    COPILOT_INSTRUCTIONS_MIGRATE_END,
    "",
  ].join("\n");
}

/**
 * Merges Copilot instructions body into `CLAUDE.md` text. Replaces an existing marked block if present;
 * otherwise appends. If `existingClaudeMd` is empty, creates a minimal Claude project file.
 */
export function mergeCopilotInstructionsIntoClaudeMdContent(
  existingClaudeMd: string,
  copilotInstructionsBody: string
): string {
  const block = buildCopilotInstructionsMigrateBlock(copilotInstructionsBody);
  const trimmed = existingClaudeMd.trim();
  if (!trimmed) {
    return `# Claude Code — project context\n${block}`;
  }
  if (
    trimmed.includes(COPILOT_INSTRUCTIONS_MIGRATE_BEGIN) &&
    trimmed.includes(COPILOT_INSTRUCTIONS_MIGRATE_END)
  ) {
    const re = new RegExp(
      `${escapeRe(COPILOT_INSTRUCTIONS_MIGRATE_BEGIN)}[\\s\\S]*?${escapeRe(COPILOT_INSTRUCTIONS_MIGRATE_END)}\\n*`,
      "m"
    );
    return trimmed.replace(re, block);
  }
  return trimmed.trimEnd() + block;
}
