import * as vscode from "vscode";
import { applyCursorToCopilotSubstitutions } from "./cursorChatMappings";

/**
 * Best-effort text substitution for chat snippets (not full parser).
 * Substitution table: `CURSOR_TO_COPILOT_SUBSTITUTIONS` in `cursorChatMappings.ts`.
 */
export async function translateCursorContextInSelection(): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) {
    vscode.window.showErrorMessage("Open an editor and select text (e.g. in a scratch file or chat export).");
    return;
  }
  const sel = ed.selection;
  const text = ed.document.getText(sel);
  if (!text.trim()) {
    vscode.window.showInformationMessage(
      "Select a region containing @-mentions to translate rough Cursor → Copilot forms."
    );
    return;
  }

  let next = applyCursorToCopilotSubstitutions(text);

  const wrap = vscode.workspace
    .getConfiguration()
    .get<boolean>("cloude-code-toolbox.translateWrapMultilineInFence", false);
  if (wrap && next.includes("\n")) {
    const lang = ed.document.languageId || "text";
    next = `\`\`\`${lang}\n${next}\n\`\`\``;
  }

  await ed.edit((b) => b.replace(sel, next));
  vscode.window.showInformationMessage(
    "Applied rough replacements (@codebase→@workspace, @file→#file:, …). Review before sending to Copilot."
  );
}
