/**
 * Pure logic: types, verbosity instruction builder, CLAUDE.md block composer.
 * No vscode imports — unit-testable.
 */

export type VerbosityLevel = "normal" | "concise" | "minimal" | "json-only";

export type TokenOptimizationConfig = {
  enabled: boolean;
  verbosityLevel: VerbosityLevel;
  projectMap: { enabled: boolean; maxFiles: number; extensions: string[] };
  readDeduplication: { enabled: boolean; windowMs: number };
  outputCompression: { enabled: boolean; maxLines: number };
  claudeIgnore: { enabled: boolean };
  contextBudget: { enabled: boolean; thresholds: number[] };
  claudeMdAnalyzer: { enabled: boolean };
  mergeInstructionsIntoClaudeMd: boolean;
};

export const DEFAULT_PROJECT_MAP_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs",
];

export function buildVerbosityInstructions(level: VerbosityLevel): string {
  switch (level) {
    case "normal":
      return "";
    case "concise":
      return [
        "- Respond concisely: 1-3 sentences max unless the user asks for detail.",
        "- Never restate the user's question or echo file contents back verbatim.",
        "- When showing code changes, show only modified lines with 2 lines of context.",
        "- Skip meta-commentary (\"I'll now...\", \"Let me...\", \"Here's what I did...\").",
      ].join("\n");
    case "minimal":
      return [
        "- Maximum brevity: bullets only, no prose paragraphs.",
        "- Never restate, echo, or summarize what the user said.",
        "- Code changes: diff-style, modified lines only.",
        "- No meta-commentary, no transition phrases, no filler.",
        "- When asked a question, answer in one line.",
      ].join("\n");
    case "json-only":
      return [
        "- Respond ONLY with valid JSON. No English prose outside JSON values.",
        "- Structure: {\"action\": \"...\", \"result\": \"...\", \"files\": [...]}",
        "- No markdown formatting, no code fences around the JSON.",
      ].join("\n");
  }
}

export type TokenOptBlockParts = {
  verbosityLevel: VerbosityLevel;
  projectMapEnabled: boolean;
  claudeIgnoreEnabled: boolean;
  readDedupEnabled: boolean;
};

export function buildTokenOptimizationBlock(parts: TokenOptBlockParts): string {
  const lines: string[] = [];
  lines.push(`### Token Optimization (Claude Code ToolBox)`);
  lines.push("");
  lines.push(`_Active level: ${parts.verbosityLevel}_`);
  lines.push("");

  const verbosity = buildVerbosityInstructions(parts.verbosityLevel);
  if (verbosity) {
    lines.push(verbosity);
  }

  if (parts.projectMapEnabled) {
    lines.push("- Before reading a file, check `.claude/project-map.md` for structural context.");
  }
  if (parts.readDedupEnabled) {
    lines.push("- If you already read a file this session and it hasn't changed, reference your memory instead of re-reading.");
  }
  if (parts.claudeIgnoreEnabled) {
    lines.push("- Do not read files matching `.claudeignore` patterns unless explicitly asked.");
  }

  return lines.join("\n");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
