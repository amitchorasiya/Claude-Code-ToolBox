import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { runNpxInTerminal } from "../terminal/runNpx";
import { portMcpToClaudeCode } from "../claudeCodeMcp";

/** Cursor MCP port targets. The CLI always merges with an existing mcp.json when present (never replaces the whole file). */
export type PortCursorMcpMode = "dry" | "user" | "workspace" | "claude" | "claudeProject";

/** Run Cursor MCP port without quick picks (One Click Setup, scripts). */
export async function runPortCursorMcpWithMode(
  folder: vscode.WorkspaceFolder,
  mode: PortCursorMcpMode,
  tag: string
): Promise<void> {
  if (mode === "claude" || mode === "claudeProject") {
    try {
      const result = await portMcpToClaudeCode({
        scope: mode === "claude" ? "user" : "project",
        workspacePath: folder.uri.fsPath,
      });
      const msg =
        result.merged.length > 0
          ? `Ported ${result.merged.length} MCP server(s) to ${result.targetPath}. ${
              result.skipped.length > 0 ? `Skipped ${result.skipped.length} existing.` : ""
            }`
          : `No new servers to port. ${result.skipped.length} already exist in ${result.targetPath}.`;
      vscode.window.showInformationMessage(msg);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Claude Code MCP port failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    return;
  }

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
      { label: "Claude Code ~/.claude.json (merge)", value: "claude" as const },
      { label: "Claude Code workspace .mcp.json (merge)", value: "claudeProject" as const },
      { label: "VS Code user mcp.json (merge)", value: "user" as const },
      { label: "VS Code workspace .vscode/mcp.json (merge)", value: "workspace" as const },
      { label: "Dry run (print JSON only)", value: "dry" as const },
    ],
    { title: "Port Cursor MCP" }
  );
  if (!mode) {
    return;
  }

  await runPortCursorMcpWithMode(folder, mode.value, tag);
}
