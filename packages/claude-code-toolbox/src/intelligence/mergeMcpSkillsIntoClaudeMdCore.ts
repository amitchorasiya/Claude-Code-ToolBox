export const MCP_SKILLS_AWARENESS_BANNER_START =
  "<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->";
export const MCP_SKILLS_AWARENESS_BANNER_END =
  "<!-- cloude-code-toolbox:mcp-skills-awareness-end -->";

export function buildMcpSkillsAwarenessInstructionsBlock(innerMarkdown: string): string {
  return [
    "",
    MCP_SKILLS_AWARENESS_BANNER_START,
    "",
    innerMarkdown.trim(),
    "",
    MCP_SKILLS_AWARENESS_BANNER_END,
    "",
  ].join("\n");
}

/** Replace the marked block if present; otherwise append. `existing` may be empty. */
export function replaceOrAppendAwarenessBlock(existing: string, block: string): string {
  const trimmed = existing.trim();
  if (!trimmed) {
    return `# Claude Code — project context\n${block}`;
  }
  if (
    trimmed.includes(MCP_SKILLS_AWARENESS_BANNER_START) &&
    trimmed.includes(MCP_SKILLS_AWARENESS_BANNER_END)
  ) {
    const re = new RegExp(
      `${escapeRe(MCP_SKILLS_AWARENESS_BANNER_START)}[\\s\\S]*?${escapeRe(MCP_SKILLS_AWARENESS_BANNER_END)}\\n*`,
      "m"
    );
    return trimmed.replace(re, block);
  }
  return trimmed + block;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
