/**
 * Best-effort Cursor @-mentions → Copilot / VS Code chat forms (not a full parser).
 */
export const CURSOR_TO_COPILOT_SUBSTITUTIONS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
}> = [
  { pattern: /@codebase\b/gi, replacement: "@workspace" },
  { pattern: /@docs\b/gi, replacement: "@vscode" },
  { pattern: /@web\b/gi, replacement: "(web: use Agent tools or paste URLs)" },
  { pattern: /@folder\b/gi, replacement: "#folder:" },
  { pattern: /@file\s+/gi, replacement: "#file:" },
];

export function applyCursorToCopilotSubstitutions(text: string): string {
  let out = text;
  for (const { pattern, replacement } of CURSOR_TO_COPILOT_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
