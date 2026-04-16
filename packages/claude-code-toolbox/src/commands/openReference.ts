import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { kitPageHtml } from "../webview/modernShell";
import { markdownToKitBody } from "../webview/mdToKitHtml";

export async function openCursorClaudeReference(
  context: vscode.ExtensionContext
): Promise<void> {
  const mdPath = path.join(
    context.extensionPath,
    "resources",
    "cursor-vs-claude-code-reference.md"
  );
  let md: string;
  try {
    md = await fs.readFile(mdPath, "utf8");
  } catch {
    await vscode.window.showErrorMessage(
      "Cloude Code ToolBox: could not read cursor-vs-claude-code-reference.md"
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "cloudeCodeKitReference",
    "Cloude Code ToolBox — Cursor vs Claude Code",
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "icon.svg"
  );

  const bodyHtml = markdownToKitBody(md);
  panel.webview.html = kitPageHtml({
    title: "Cursor vs Claude Code",
    subtitle:
      "Quick reference for rules, chat context, shortcuts, and workflow — styled to match your theme.",
    bodyHtml,
  });
}
