import * as path from "node:path";
import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

async function stat(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
}

export type KitPayload = {
  key: string;
  present: boolean;
  path: string;
  uri?: vscode.Uri;
  isDirectory?: boolean;
  /** When missing, palette command to scaffold */
  runCommand?: string;
  isWizard?: boolean;
};

/** Plain snapshot for MCP hub webview */
export type KitSnapshotRow = {
  id: string;
  label: string;
  present: boolean;
  displayPath: string;
  runCommand?: string;
  openUri?: string;
  isDirectory?: boolean;
  isWizard?: boolean;
};

type KitCheckDef = { id: string; key: string; rel: string; runCommand?: string };

const KIT_CHECKS: KitCheckDef[] = [
  {
    id: "cursor-rules-dir",
    key: "Cursor rules",
    rel: ".cursor/rules",
    runCommand: "CloudeCodeToolBox.syncCursorRules",
  },
  {
    id: "cursorrules-file",
    key: ".cursorrules",
    rel: ".cursorrules",
    runCommand: "CloudeCodeToolBox.createCursorrulesTemplate",
  },
  {
    id: "memory-bank",
    key: "Memory bank",
    rel: "memory-bank",
    runCommand: "CloudeCodeToolBox.initMemoryBank",
  },
  {
    id: "claude-md",
    key: "CLAUDE.md",
    rel: "CLAUDE.md",
  },
  {
    id: "mcp-json",
    key: "Workspace mcp.json",
    rel: ".vscode/mcp.json",
    runCommand: "CloudeCodeToolBox.portCursorMcp",
  },
];

async function resolveKitPayloads(
  folder: vscode.WorkspaceFolder
): Promise<Array<KitPayload & { id: string }>> {
  const root = folder.uri;
  const items: Array<KitPayload & { id: string }> = [];
  for (const c of KIT_CHECKS) {
    const uri = vscode.Uri.joinPath(root, ...c.rel.split("/"));
    const st = await stat(uri);
    const present = !!st;
    const isDir = st ? (st.type & vscode.FileType.Directory) !== 0 : false;
    items.push({
      id: c.id,
      key: c.key,
      present,
      path: path.join(folder.name, c.rel),
      uri: present ? uri : undefined,
      isDirectory: present ? isDir : undefined,
      runCommand: c.runCommand,
    });
  }
  return items;
}

/** Workspace kit rows for hub webview (no folder → single placeholder row). */
export async function gatherWorkspaceKitSnapshot(): Promise<KitSnapshotRow[]> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    return [
      {
        id: "no-folder",
        label: "Open a workspace folder",
        present: false,
        displayPath: "Required for Cursor rules, memory bank, and workspace MCP",
      },
    ];
  }
  const payloads = await resolveKitPayloads(folder);
  const rows: KitSnapshotRow[] = payloads.map((p) => ({
    id: p.id,
    label: p.key,
    present: p.present,
    displayPath: p.path,
    runCommand: p.runCommand,
    openUri: p.uri?.toString(),
    isDirectory: p.isDirectory,
  }));
  rows.unshift({
    id: "one-click",
    label: "One Click Setup",
    present: true,
    displayPath: "Configurable Cursor → Claude Code flow (see settings)",
    isWizard: true,
  });
  return rows;
}

export class WorkspaceKitProvider implements vscode.TreeDataProvider<KitTreeItem> {
  private _onDidChange = new vscode.EventEmitter<KitTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: KitTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<KitTreeItem[]> {
    const folder = mcpPaths.getPrimaryWorkspaceFolder();
    if (!folder) {
      return [
        new KitTreeItem("no-folder", "Open a workspace folder", {
          key: "—",
          present: false,
          path: "",
        }),
      ];
    }
    const payloads = await resolveKitPayloads(folder);
    const items: KitTreeItem[] = payloads.map(
      (p) =>
        new KitTreeItem(
          `kit-${p.id}`,
          p.present ? `✓ ${p.key}` : `○ ${p.key} (missing)`,
          {
            key: p.key,
            present: p.present,
            path: p.path,
            uri: p.uri,
            isDirectory: p.isDirectory,
            runCommand: p.runCommand,
          }
        )
    );

    items.unshift(
      new KitTreeItem("one-click", "One Click Setup…", {
        key: "one-click",
        present: true,
        path: "",
        isWizard: true,
      })
    );

    return items;
  }
}

export class KitTreeItem extends vscode.TreeItem {
  constructor(id: string, label: string, public readonly payload: KitPayload) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = id;
    this.description = payload.present ? "" : "click to scaffold";
    this.tooltip = payload.path || payload.key;
    if (payload.isWizard) {
      this.iconPath = new vscode.ThemeIcon("rocket");
      this.command = {
        command: "CloudeCodeToolBox.runOneClickSetup",
        title: "One Click Setup",
      };
      return;
    }
    if (!payload.present) {
      this.iconPath = new vscode.ThemeIcon("circle-outline");
      if (payload.runCommand) {
        this.command = {
          command: payload.runCommand,
          title: "Run",
        };
      }
      return;
    }
    this.iconPath = new vscode.ThemeIcon("check");
    if (payload.uri) {
      this.command = {
        command: "CloudeCodeToolBox.openKitTarget",
        title: "Open",
        arguments: [payload.uri.toString(), !!payload.isDirectory],
      };
    }
  }
}
