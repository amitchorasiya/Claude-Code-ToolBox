import * as vscode from "vscode";

export async function mcpBrowseRegistry(): Promise<void> {
  try {
    await vscode.commands.executeCommand("workbench.extensions.search", "@mcp");
    return;
  } catch {
    /* fall through */
  }
  try {
    await vscode.commands.executeCommand("workbench.view.extensions");
  } catch {
    /* ignore */
  }
  await vscode.env.openExternal(vscode.Uri.parse("https://modelcontextprotocol.io/"));
}

export async function mcpAddServerNative(): Promise<void> {
  try {
    await vscode.commands.executeCommand("workbench.mcp.addConfiguration");
  } catch {
    vscode.window.showErrorMessage(
      "MCP Add Server command unavailable. Update to a recent VS Code build with MCP support."
    );
  }
}
