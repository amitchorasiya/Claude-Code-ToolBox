import * as os from "node:os";
import * as vscode from "vscode";
import * as mcpConfig from "../mcpConfig";
import * as mcpPaths from "../mcpPaths";
import { installSkillFromSkillsSh } from "../commands/installSkillFromSkillsSh";
import { installMcpFromRegistryEntry } from "../registry/mcpRegistryInstall";
import { searchMcpRegistry } from "../registry/mcpRegistryClient";
import { searchSkillsSh } from "../registry/skillsShClient";
import { collectLocalSkills, type SkillEntry } from "../skills/localSkills";
import {
  applyHubDisabledFlagsToSkills,
  setSkillHubDisabled,
  setSkillHubEnabled,
} from "../skills/skillHubState";
import {
  buildMcpServerRowsForHub,
  mcpHubDeleteServer,
  mcpHubTurnOffServer,
  mcpHubTurnOnServer,
} from "../mcpHubMutations";
import { gatherWorkspaceKitSnapshot, type KitSnapshotRow } from "../tree/workspaceKitProvider";
import { getHubWebviewHtml } from "./hubWebviewDocument";
import { deleteSkillFolderFromHub } from "../commands/deleteSkillFolder";

export type { SkillEntry };

export type McpServerRow = {
  id: string;
  kind: string;
  detail: string;
  scope: "workspace" | "user";
  /** When true, config is stored by the Toolbox (not in mcp.json) until Turn ON. */
  disabled?: boolean;
};

export type HubHygiene = {
  workspaceMcpServerCount: number;
  userMcpServerCount: number;
  /** `CLAUDE.md` — line count when present. */
  claudeMdLines: number | null;
  claudeMdMissing: boolean;
};

export type HubPayload = {
  workspaceName?: string;
  workspaceServers: McpServerRow[];
  userServers: McpServerRow[];
  workspaceMcp: "missing" | "empty" | "ok";
  userMcp: "missing" | "empty" | "ok";
  skills: SkillEntry[];
  kit: KitSnapshotRow[];
  /** Mirrors `cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen`. */
  autoScanMcpSkillsOnWorkspaceOpen: boolean;
  /** Mirrors `cloude-code-toolbox.thinkingMachineMode.enabled`. */
  thinkingMachineModeEnabled: boolean;
  /** File/config snapshot for the Thinking Machine hub (not token usage). */
  hygiene: HubHygiene;
  /** Set when `gatherHubPayload` failed; UI still loads with `emptyHubPayload()` defaults. */
  hubLoadError?: string;
  /** Shared hub HTML: JetBrains hides duplicate npx vs bundled bridge buttons. */
  hubHost?: "vscode" | "intellij";
};

export async function gatherHubPayload(context: vscode.ExtensionContext): Promise<HubPayload> {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const folder = mcpPaths.getPrimaryWorkspaceFolder();

  let workspaceServers: McpServerRow[] = [];
  let workspaceMcp: HubPayload["workspaceMcp"] = "missing";
  if (folder) {
    const uri = mcpPaths.workspaceMcpUri(folder);
    const parsed = await mcpConfig.parseMcpServers(uri);
    if (parsed === undefined) {
      workspaceMcp = "missing";
    } else if (parsed.length === 0) {
      workspaceMcp = "empty";
    } else {
      workspaceMcp = "ok";
    }
    workspaceServers = await buildMcpServerRowsForHub(context, uri, "workspace");
  }

  const userUri = vscode.Uri.file(mcpPaths.userMcpJsonPath(insiders));
  const userParsed = await mcpConfig.parseMcpServers(userUri);
  let userMcp: HubPayload["userMcp"] = "missing";
  let userServers: McpServerRow[] = [];
  if (userParsed === undefined) {
    userMcp = "missing";
  } else if (userParsed.length === 0) {
    userMcp = "empty";
  } else {
    userMcp = "ok";
  }
  userServers = await buildMcpServerRowsForHub(context, userUri, "user");

  const rawSkills = await collectLocalSkills(os.homedir(), folder?.uri.fsPath);
  const skills = await applyHubDisabledFlagsToSkills(context, rawSkills);

  const kit = await gatherWorkspaceKitSnapshot();

  const autoScanMcpSkillsOnWorkspaceOpen =
    cfg.get<boolean>("cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen") === true;
  const thinkingMachineModeEnabled =
    cfg.get<boolean>("cloude-code-toolbox.thinkingMachineMode.enabled") === true;

  let claudeMdLines: number | null = null;
  let claudeMdMissing = true;
  if (folder) {
    const instr = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
    try {
      const buf = await vscode.workspace.fs.readFile(instr);
      claudeMdMissing = false;
      const text = new TextDecoder().decode(buf);
      claudeMdLines = text.split(/\r?\n/).length;
    } catch {
      claudeMdMissing = true;
    }
  }

  const hygiene: HubHygiene = {
    workspaceMcpServerCount: workspaceServers.filter((s) => !s.disabled).length,
    userMcpServerCount: userServers.filter((s) => !s.disabled).length,
    claudeMdLines,
    claudeMdMissing,
  };

  return {
    workspaceName: folder?.name,
    workspaceServers,
    userServers,
    workspaceMcp,
    userMcp,
    skills,
    kit,
    autoScanMcpSkillsOnWorkspaceOpen,
    thinkingMachineModeEnabled,
    hygiene,
    hubHost: "vscode",
  };
}

/** Safe defaults when `gatherHubPayload` throws so the hub webview can still render. */
export function emptyHubPayload(): HubPayload {
  return {
    workspaceServers: [],
    userServers: [],
    workspaceMcp: "missing",
    userMcp: "missing",
    skills: [],
    kit: [],
    autoScanMcpSkillsOnWorkspaceOpen: false,
    thinkingMachineModeEnabled: false,
    hygiene: {
      workspaceMcpServerCount: 0,
      userMcpServerCount: 0,
      claudeMdLines: null,
      claudeMdMissing: true,
    },
    hubHost: "vscode",
  };
}

const HUB_PAYLOAD_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Activity bar (Cloude Code ToolBox) — first view */
export const MCP_SKILLS_HUB_VIEW_ACTIVITY = "cloudeCodeKitMcp";
/** Secondary sidebar container — webview tab beside Chat (see `package.json` `secondarySidebar`) */
export const MCP_SKILLS_HUB_VIEW_SECONDARY = "cloudeCodeKitMcpSecondary";

export class McpSkillsHubViewProvider implements vscode.WebviewViewProvider {
  /** @deprecated Use MCP_SKILLS_HUB_VIEW_ACTIVITY */
  public static readonly viewType = MCP_SKILLS_HUB_VIEW_ACTIVITY;

  private _view?: vscode.WebviewView;
  /** Serialize hub refreshes so parallel `gatherHubPayload` calls cannot stack on slow disks. */
  private _hubPostChain: Promise<void> = Promise.resolve();

  constructor(private readonly _ctx: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready":
        case "refresh":
          this._postState();
          break;
        case "runCommand":
          if (typeof msg.command === "string") {
            try {
              await vscode.commands.executeCommand(msg.command);
            } catch {
              vscode.window.showErrorMessage(`Command failed: ${msg.command}`);
            }
          }
          this._postState();
          break;
        case "runCommandWithArgs":
          if (typeof msg.command === "string" && Array.isArray(msg.args)) {
            try {
              await vscode.commands.executeCommand(msg.command, ...(msg.args as unknown[]));
            } catch {
              vscode.window.showErrorMessage(`Command failed: ${msg.command}`);
            }
          }
          this._postState();
          break;
        case "openFile":
          if (typeof msg.fsPath === "string") {
            const u = vscode.Uri.file(msg.fsPath);
            try {
              await vscode.window.showTextDocument(u);
            } catch {
              vscode.window.showErrorMessage(`Could not open: ${msg.fsPath}`);
            }
          }
          break;
        case "revealPath":
          if (typeof msg.fsPath === "string") {
            const u = vscode.Uri.file(msg.fsPath);
            try {
              const stat = await vscode.workspace.fs.stat(u);
              if ((stat.type & vscode.FileType.Directory) !== 0) {
                await vscode.commands.executeCommand("revealInExplorer", u);
              } else {
                await vscode.commands.executeCommand("revealFileInOS", u);
              }
            } catch {
              vscode.window.showErrorMessage(`Could not reveal: ${msg.fsPath}`);
            }
          }
          break;
        case "registrySearch": {
          const generation = typeof msg.generation === "number" ? msg.generation : 0;
          const search = typeof msg.search === "string" ? msg.search : "";
          const cursor = typeof msg.cursor === "string" ? msg.cursor : undefined;
          const append = msg.append === true;
          try {
            const { servers, metadata } = await searchMcpRegistry({
              search,
              limit: 12,
              cursor,
            });
            this._view?.webview.postMessage({
              type: "registrySearchResult",
              generation,
              append,
              servers,
              nextCursor: metadata.nextCursor,
              error: null,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this._view?.webview.postMessage({
              type: "registrySearchResult",
              generation,
              append: false,
              servers: [],
              nextCursor: undefined,
              error: message,
            });
          }
          break;
        }
        case "skillSearch": {
          const generation = typeof msg.generation === "number" ? msg.generation : 0;
          const query = typeof msg.query === "string" ? msg.query : "";
          try {
            const items = await searchSkillsSh(query, { limit: 15 });
            this._view?.webview.postMessage({
              type: "skillSearchResult",
              generation,
              items,
              error: null,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this._view?.webview.postMessage({
              type: "skillSearchResult",
              generation,
              items: [],
              error: message,
            });
          }
          break;
        }
        case "installMcpRegistry":
          await installMcpFromRegistryEntry(msg.entry);
          this._postState();
          break;
        case "installSkillSh":
          if (typeof msg.source === "string" && typeof msg.skillId === "string") {
            await installSkillFromSkillsSh({
              source: msg.source,
              skillId: msg.skillId,
              global: msg.global === true,
            });
          }
          this._postState();
          break;
        case "setAutoScanMcpSkillsOnWorkspaceOpen": {
          const hasWs = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
          await vscode.workspace.getConfiguration().update(
            "cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen",
            msg.value === true,
            hasWs ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global
          );
          this._postState();
          break;
        }
        case "setThinkingMachineModeEnabled": {
          const hasWs = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
          await vscode.workspace.getConfiguration().update(
            "cloude-code-toolbox.thinkingMachineMode.enabled",
            msg.value === true,
            hasWs ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global
          );
          this._postState();
          break;
        }
        case "mcpToggleServer": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const id = typeof msg.id === "string" ? msg.id : "";
          const enable = msg.enable === true;
          if (!id) {
            break;
          }
          try {
            if (enable) {
              await mcpHubTurnOnServer(this._ctx, scope, id);
            } else {
              await mcpHubTurnOffServer(this._ctx, scope, id);
            }
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MCP toggle failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "mcpDeleteServer": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const id = typeof msg.id === "string" ? msg.id : "";
          if (!id) {
            break;
          }
          try {
            await mcpHubDeleteServer(this._ctx, scope, id);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MCP remove failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "skillToggleHub": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const skillId = typeof msg.skillId === "string" ? msg.skillId : "";
          const enable = msg.enable === true;
          if (!skillId) {
            break;
          }
          try {
            if (enable) {
              await setSkillHubEnabled(this._ctx, scope, skillId);
            } else {
              await setSkillHubDisabled(this._ctx, scope, skillId);
            }
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Skill hub toggle failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "deleteSkillFolder": {
          const fsPath = typeof msg.fsPath === "string" ? msg.fsPath : "";
          const scope = msg.scope === "user" ? "user" : "workspace";
          if (!fsPath) {
            break;
          }
          await deleteSkillFolderFromHub(this._ctx, fsPath, scope);
          this._postState();
          break;
        }
        default:
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._postState();
      }
    });
  }

  refresh(): void {
    this._postState();
  }

  /** Enqueue a hub payload refresh (serialized; safe to call from message handlers). */
  private _postState(): void {
    this._hubPostChain = this._hubPostChain
      .then(() => this._postStateOnce())
      .catch((e) => {
        console.error("[Cloude Code ToolBox] hub post chain", e);
      });
  }

  private async _postStateOnce(): Promise<void> {
    if (!this._view) {
      return;
    }
    let payload: HubPayload;
    try {
      payload = await withTimeout(gatherHubPayload(this._ctx), HUB_PAYLOAD_TIMEOUT_MS);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Cloude Code ToolBox] gatherHubPayload failed or timed out", e);
      const hint =
        message.includes("timed out") || message.includes("timeout")
          ? `Timed out after ${HUB_PAYLOAD_TIMEOUT_MS / 1000}s (slow or remote workspace disk). Try opening a local folder or reload the window.`
          : message;
      payload = { ...emptyHubPayload(), hubLoadError: hint };
    }
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({ type: "state", payload });
  }

  private _getHtml(): string {
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'unsafe-inline'",
    ].join("; ");
    return getHubWebviewHtml(csp);
  }
}
