import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { runNpxInTerminal } from "../terminal/runNpx";

/** Cursor MCP port targets. The CLI always merges with an existing mcp.json when present (never replaces the whole file). */
export type PortCursorMcpMode = "dry" | "user" | "workspace";

/** Run Cursor MCP port without quick picks (One Click Setup, scripts). */
export function runPortCursorMcpWithMode(
  folder: vscode.WorkspaceFolder,
  mode: PortCursorMcpMode,
  tag: string
): void {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const args: string[] = [];
  if (mode === "dry") {
    args.push("--dry-run");
  } else if (mode === "user") {
    args.push("-t", insiders ? "insiders" : "user");
  }
  // workspace: default CLI target is .vscode/mcp.json under cwd — no extra flags
  runNpxInTerminal(
    folder.uri.fsPath,
    "cursor-mcp-vscode-port",
    tag,
    args,
    "Cursor MCP port"
  );
}

export async function portCursorMcp(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const tag = mcpPaths.npxTag(cfg);

  const mode = await vscode.window.showQuickPick(
    [
      { label: "User mcp.json (merge with existing)", value: "user" as const },
      { label: "Workspace .vscode/mcp.json (merge with existing)", value: "workspace" as const },
      { label: "Dry run (print JSON only)", value: "dry" as const },
    ],
    { title: "Port Cursor MCP → VS Code" }
  );
  if (!mode) {
    return;
  }

  runPortCursorMcpWithMode(folder, mode.value, tag);
}
