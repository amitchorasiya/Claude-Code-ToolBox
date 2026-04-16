import * as vscode from "vscode";
import { kitPageHtml, kitCard } from "../webview/modernShell";

/**
 * Lightweight session hub: shortcuts and tips (not a full Composer clone).
 */
export function openComposerHubPanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    "cloudeCodeComposerHub",
    "Cloude Code ToolBox — session hub",
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "icon.svg"
  );

  panel.webview.html = getComposerHubHtml();
}

function getComposerHubHtml(): string {
  const shortcuts = kitCard(
    "Shortcuts",
    `<ul>
      <li><strong>Open Claude Code</strong> — <code>Cloude Code ToolBox: Open Claude Code</code></li>
      <li><strong>Inline / panel</strong> — toolbox binding <code>Ctrl+Alt+K</code> / <code>Cmd+Alt+K</code>; see Claude Code docs for <code>Alt+K</code> @-inserts</li>
      <li><strong>MCP</strong> — VS Code <code>mcp.json</code> plus Claude Code <code>/mcp</code></li>
    </ul>`
  );

  const workflow = kitCard(
    "Workflow",
    `<p>Claude Code gives you a <strong>dedicated panel</strong>, <strong>tabs</strong>, and <strong>plan review</strong> — closer to Cursor’s multi-step flow than a single inline popover.</p>
    <p><a class="kit-link" href="https://code.claude.com/docs/en/vs-code/">Claude Code in VS Code</a>
    <a class="kit-link kit-link--secondary" href="https://modelcontextprotocol.io/">Model Context Protocol</a></p>`
  );

  return kitPageHtml({
    title: "Session hub",
    subtitle:
      "Use this toolbox’s tree and commands to jump faster between Cursor-style rules, MCP, and Claude Code.",
    bodyHtml: workflow + shortcuts,
  });
}
