import * as vscode from "vscode";
import * as mcpConfig from "../mcpConfig";
import * as mcpPaths from "../mcpPaths";

export const MCP_CMD = {
  listServer: "workbench.mcp.listServer",
  openWorkspaceMcp: "workbench.mcp.openWorkspaceFolderMcpJson",
  openUserMcp: "workbench.mcp.openUserMcpJson",
  browseServers: "workbench.mcp.browseServers",
  addConfiguration: "workbench.mcp.addConfiguration",
} as const;

type RootKind = "workspace" | "user";

export class McpTreeProvider implements vscode.TreeDataProvider<McpTreeItem> {
  private _onDidChange = new vscode.EventEmitter<McpTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(_ctx: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: McpTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: McpTreeItem): Promise<McpTreeItem[]> {
    const cfg = vscode.workspace.getConfiguration();
    const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
    const folder = mcpPaths.getPrimaryWorkspaceFolder();

    if (!element) {
      return [
        new McpTreeItem(
          "workspace-root",
          "Workspace mcp.json",
          vscode.TreeItemCollapsibleState.Expanded,
          { kind: "root", scope: "workspace" }
        ),
        new McpTreeItem(
          "user-root",
          "User mcp.json",
          vscode.TreeItemCollapsibleState.Expanded,
          { kind: "root", scope: "user" }
        ),
        new McpTreeItem(
          "actions",
          "Quick actions",
          vscode.TreeItemCollapsibleState.Collapsed,
          { kind: "actions" }
        ),
      ];
    }

    if (element.payload.kind === "actions") {
      return [
        McpTreeItem.commandItem("list", "List servers (native)", MCP_CMD.listServer),
        McpTreeItem.commandItem("browse", "Browse MCP registry", MCP_CMD.browseServers),
        McpTreeItem.commandItem("add", "Add server (native)", MCP_CMD.addConfiguration),
        McpTreeItem.commandItem("port", "Port from Cursor (npx)", "CloudeCodeToolBox.portCursorMcp"),
      ];
    }

    if (element.payload.kind === "root") {
      const scope = element.payload.scope;
      if (scope === "workspace") {
        if (!folder) {
          return [
            new McpTreeItem(
              "no-ws",
              "Open a workspace folder",
              vscode.TreeItemCollapsibleState.None,
              { kind: "hint", message: "Open a folder to see workspace MCP servers." }
            ),
          ];
        }
        const uri = mcpPaths.workspaceMcpUri(folder);
        const servers = await mcpConfig.parseMcpServers(uri);
        if (servers === undefined) {
          return [
            new McpTreeItem(
              "missing",
              "No .vscode/mcp.json (click to create)",
              vscode.TreeItemCollapsibleState.None,
              { kind: "openMcp", scope: "workspace", uri }
            ),
          ];
        }
        if (servers.length === 0) {
          return [
            new McpTreeItem(
              "empty",
              "No servers defined",
              vscode.TreeItemCollapsibleState.None,
              { kind: "openMcp", scope: "workspace", uri }
            ),
          ];
        }
        return servers.map(
          (s) =>
            new McpTreeItem(
              `ws-${s.id}`,
              s.id,
              vscode.TreeItemCollapsibleState.None,
              { kind: "server", scope: "workspace", summary: s }
            )
        );
      }
      const userPath = mcpPaths.userMcpJsonPath(insiders);
      const uri = vscode.Uri.file(userPath);
      const servers = await mcpConfig.parseMcpServers(uri);
      if (servers === undefined) {
        return [
          new McpTreeItem(
            "no-user",
            "No user mcp.json (open to create)",
            vscode.TreeItemCollapsibleState.None,
            { kind: "openMcp", scope: "user", uri }
          ),
        ];
      }
      if (servers.length === 0) {
        return [
          new McpTreeItem(
            "empty-user",
            "No servers defined",
            vscode.TreeItemCollapsibleState.None,
            { kind: "openMcp", scope: "user", uri }
          ),
        ];
      }
      return servers.map(
        (s) =>
          new McpTreeItem(
            `us-${s.id}`,
            s.id,
            vscode.TreeItemCollapsibleState.None,
            { kind: "server", scope: "user", summary: s }
          )
      );
    }

    return [];
  }
}

export type McpPayload =
  | { kind: "root"; scope: RootKind }
  | { kind: "actions" }
  | { kind: "hint"; message: string }
  | { kind: "openMcp"; scope: RootKind; uri: vscode.Uri }
  | { kind: "server"; scope: RootKind; summary: mcpConfig.ServerSummary };

export class McpTreeItem extends vscode.TreeItem {
  constructor(
    id: string,
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    public readonly payload: McpPayload
  ) {
    super(label, collapsible);
    this.id = id;
    if (payload.kind === "server") {
      this.description = payload.summary.kind;
      this.tooltip = `${payload.summary.kind}\n${payload.summary.detail}`;
      this.iconPath = new vscode.ThemeIcon("server-process");
      this.command = {
        command:
          payload.scope === "workspace"
            ? MCP_CMD.openWorkspaceMcp
            : MCP_CMD.openUserMcp,
        title: "Open mcp.json",
      };
    } else if (payload.kind === "openMcp") {
      this.iconPath = new vscode.ThemeIcon("json");
      this.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [payload.uri],
      };
    } else if (payload.kind === "hint") {
      this.iconPath = new vscode.ThemeIcon("info");
    } else if (payload.kind === "root") {
      this.iconPath = new vscode.ThemeIcon("folder");
    } else if (payload.kind === "actions") {
      this.iconPath = new vscode.ThemeIcon("zap");
    }
  }

  static commandItem(
    id: string,
    label: string,
    commandId: string
  ): McpTreeItem {
    const item = new McpTreeItem(
      `act-${id}`,
      label,
      vscode.TreeItemCollapsibleState.None,
      { kind: "hint", message: label }
    );
    item.iconPath = new vscode.ThemeIcon("play");
    item.command = { command: commandId, title: label };
    return item;
  }
}
