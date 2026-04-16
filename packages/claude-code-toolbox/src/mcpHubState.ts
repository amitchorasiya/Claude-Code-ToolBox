import * as vscode from "vscode";

const WS_KEY = "CloudeCodeToolBox.mcpDisabledServers.workspace";
const USER_KEY = "CloudeCodeToolBox.mcpDisabledServers.user";

function getMap(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user"
): Record<string, unknown> {
  const raw =
    scope === "workspace"
      ? context.workspaceState.get<unknown>(WS_KEY)
      : context.globalState.get<unknown>(USER_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

async function setMap(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  map: Record<string, unknown>
): Promise<void> {
  if (scope === "workspace") {
    await context.workspaceState.update(WS_KEY, map);
  } else {
    await context.globalState.update(USER_KEY, map);
  }
}

export async function stashDisabledMcpServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string,
  config: unknown
): Promise<void> {
  const map = getMap(context, scope);
  map[serverId] = config;
  await setMap(context, scope, map);
}

export async function popDisabledMcpServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string
): Promise<unknown | undefined> {
  const map = getMap(context, scope);
  const cfg = map[serverId];
  if (cfg === undefined) {
    return undefined;
  }
  delete map[serverId];
  await setMap(context, scope, map);
  return cfg;
}

export async function removeDisabledMcpServer(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  serverId: string
): Promise<void> {
  const map = getMap(context, scope);
  if (map[serverId] === undefined) {
    return;
  }
  delete map[serverId];
  await setMap(context, scope, map);
}

/** Disabled server configs not currently present in mcp.json `servers`. */
export function listDisabledMcpServers(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user"
): Record<string, unknown> {
  return getMap(context, scope);
}

/** Drop stash entries whose id already exists in the live mcp.json (stale). */
export async function pruneStaleDisabledMcpServers(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  liveServerIds: Set<string>
): Promise<void> {
  const map = getMap(context, scope);
  let changed = false;
  for (const id of Object.keys(map)) {
    if (liveServerIds.has(id)) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) {
    await setMap(context, scope, map);
  }
}
