/**
 * HTML comment marker block management for Token Optimization in CLAUDE.md.
 * Pure logic — no vscode imports.
 */

export const TOKEN_OPT_BANNER_START =
  "<!-- cloude-code-toolbox:token-optimization-begin -->";
export const TOKEN_OPT_BANNER_END =
  "<!-- cloude-code-toolbox:token-optimization-end -->";

export function buildTokenOptInstructionsBlock(innerMarkdown: string): string {
  return [
    "",
    TOKEN_OPT_BANNER_START,
    "",
    innerMarkdown.trim(),
    "",
    TOKEN_OPT_BANNER_END,
    "",
  ].join("\n");
}

export function replaceOrAppendTokenOptBlock(existing: string, block: string): string {
  const trimmed = existing.trim();
  if (!trimmed) {
    return `# Claude Code — project context\n${block}`;
  }
  if (
    trimmed.includes(TOKEN_OPT_BANNER_START) &&
    trimmed.includes(TOKEN_OPT_BANNER_END)
  ) {
    const re = new RegExp(
      `${escapeRe(TOKEN_OPT_BANNER_START)}[\\s\\S]*?${escapeRe(TOKEN_OPT_BANNER_END)}\\n*`,
      "m"
    );
    return trimmed.replace(re, block);
  }
  return trimmed + block;
}

export function removeTokenOptBlock(existing: string): string {
  const trimmed = existing.trim();
  if (
    !trimmed.includes(TOKEN_OPT_BANNER_START) ||
    !trimmed.includes(TOKEN_OPT_BANNER_END)
  ) {
    return trimmed;
  }
  const re = new RegExp(
    `\\n*${escapeRe(TOKEN_OPT_BANNER_START)}[\\s\\S]*?${escapeRe(TOKEN_OPT_BANNER_END)}\\n*`,
    "m"
  );
  return trimmed.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
