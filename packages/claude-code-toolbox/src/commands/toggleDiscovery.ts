import * as vscode from "vscode";

export async function toggleMcpDiscovery(): Promise<void> {
  const conf = vscode.workspace.getConfiguration();
  const cur = conf.get<boolean>("chat.mcp.discovery.enabled");
  const next = !cur;
  await conf.update(
    "chat.mcp.discovery.enabled",
    next,
    vscode.ConfigurationTarget.Global
  );
  vscode.window.showInformationMessage(
    `chat.mcp.discovery.enabled = ${next}`
  );
}
