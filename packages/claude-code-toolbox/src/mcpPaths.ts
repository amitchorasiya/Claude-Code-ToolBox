import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "./toolboxSettings";

export function userMcpJsonPath(insiders: boolean): string {
  const home = os.homedir();
  const dir = insiders ? "Code - Insiders" : "Code";
  const plat = process.platform;
  if (plat === "darwin") {
    return path.join(home, "Library", "Application Support", dir, "User", "mcp.json");
  }
  if (plat === "win32") {
    const appData =
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return path.join(appData, dir, "User", "mcp.json");
  }
  return path.join(home, ".config", dir, "User", "mcp.json");
}

export function workspaceMcpUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, ".vscode", "mcp.json");
}

export function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0];
}

export function npxTag(config: vscode.WorkspaceConfiguration): string {
  const t = config.get<string>(`${TOOLBOX_SETTINGS_PREFIX}.npxTag`, "latest").trim();
  return t || "latest";
}
