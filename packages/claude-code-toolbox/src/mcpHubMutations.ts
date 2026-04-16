import * as vscode from "vscode";
import { parseMcpServers, summarizeServer, type ServerSummary } from "./mcpConfig";
import * as mcpJsonDocument from "./mcpJsonDocument";
import * as mcpHubState from "./mcpHubState";
import * as mcpPaths from "./mcpPaths";

function mcpUriForScope(
  scope: "workspace" | "user",
  insiders: boolean
): vscode.Uri | undefined {
  if (scope === "workspace") {
    const folder = mcpPaths.getPrimaryWorkspaceFolder();
    return folder ? mcpPaths.workspaceMcpUri(folder) : undefined;
  }
  return vscode.Uri.file(mcpPaths.userMcpJsonPath(insiders));
}

export async function mcpHubTurnOffServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const uri = mcpUriForScope(scope, insiders);
  if (!uri) {
    vscode.window.showErrorMessage("Open a workspace folder to change workspace MCP servers.");
    return;
  }
  const { raw } = await mcpJsonDocument.readOrEmptyMcpJson(uri);
  const servers = mcpJsonDocument.getServersObject(raw);
  const entry = servers[serverId];
  if (entry === undefined) {
    vscode.window.showWarningMessage(`Server "${serverId}" is not in ${scope} mcp.json.`);
    return;
  }
  delete servers[serverId];
  await mcpHubState.stashDisabledMcpServer(context, scope, serverId, entry);
  await mcpJsonDocument.writeMcpJsonDocument(uri, raw);
  vscode.window.showInformationMessage(
    `MCP server "${serverId}" turned off (${scope}). Config is saved by the Toolbox — use Turn ON to restore.`
  );
}

export async function mcpHubTurnOnServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const uri = mcpUriForScope(scope, insiders);
  if (!uri) {
    vscode.window.showErrorMessage("Open a workspace folder to change workspace MCP servers.");
    return;
  }
  const restored = await mcpHubState.popDisabledMcpServer(context, scope, serverId);
  if (restored === undefined) {
    vscode.window.showWarningMessage(`No saved config for "${serverId}" (${scope}).`);
    return;
  }
  const { raw } = await mcpJsonDocument.readOrEmptyMcpJson(uri);
  const servers = mcpJsonDocument.getServersObject(raw);
  if (servers[serverId] !== undefined) {
    await mcpHubState.stashDisabledMcpServer(context, scope, serverId, restored);
    vscode.window.showErrorMessage(
      `mcp.json already has a server named "${serverId}". Remove or rename it first.`
    );
    return;
  }
  servers[serverId] = restored;
  await mcpJsonDocument.writeMcpJsonDocument(uri, raw);
  vscode.window.showInformationMessage(`MCP server "${serverId}" turned on (${scope}).`);
}

export async function mcpHubDeleteServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string
): Promise<void> {
  const pick = await vscode.window.showWarningMessage(
    `Remove MCP server "${serverId}" (${scope}) permanently from mcp.json / Toolbox stash?`,
    { modal: true },
    "Remove",
    "Cancel"
  );
  if (pick !== "Remove") {
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const uri = mcpUriForScope(scope, insiders);
  if (!uri) {
    vscode.window.showErrorMessage("Open a workspace folder to change workspace MCP servers.");
    return;
  }
  await mcpHubState.removeDisabledMcpServer(context, scope, serverId);
  const { raw } = await mcpJsonDocument.readOrEmptyMcpJson(uri);
  const servers = mcpJsonDocument.getServersObject(raw);
  if (servers[serverId] !== undefined) {
    delete servers[serverId];
    await mcpJsonDocument.writeMcpJsonDocument(uri, raw);
  }
  vscode.window.showInformationMessage(`MCP server "${serverId}" removed.`);
}

/** Builds hub rows: live `mcp.json` servers plus Toolbox-stashed disabled configs. */
export async function buildMcpServerRowsForHub(
  context: vscode.ExtensionContext,
  uri: vscode.Uri | undefined,
  scope: "workspace" | "user"
): Promise<(ServerSummary & { scope: "workspace" | "user"; disabled?: boolean })[]> {
  type Row = ServerSummary & { scope: "workspace" | "user"; disabled?: boolean };
  const rows: Row[] = [];
  if (!uri) {
    return rows;
  }
  const parsed = await parseMcpServers(uri);
  const liveIds = new Set<string>();
  if (parsed) {
    for (const s of parsed) {
      liveIds.add(s.id);
      rows.push({ ...s, scope, disabled: false });
    }
  }
  await mcpHubState.pruneStaleDisabledMcpServers(context, scope, liveIds);
  const stash = mcpHubState.listDisabledMcpServers(context, scope);
  for (const id of Object.keys(stash)) {
    if (liveIds.has(id)) {
      continue;
    }
    rows.push({
      ...summarizeServer(id, stash[id]),
      scope,
      disabled: true,
    });
  }
  return rows;
}
