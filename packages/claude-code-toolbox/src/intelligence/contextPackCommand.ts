import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { appendToSessionNotepad } from "../commands/sessionNotepad";
import { openClaudeCodePanel } from "../commands/openClaudeCode";
import {
  buildContextPackMarkdown,
  DEFAULT_PACK_NOTICE,
  type ContextPackParts,
} from "./contextPackCore";
import { buildGitSection } from "./gitSpawn";

const MAX_OPEN_EDITORS = 14;
const MAX_SELECTION_CHARS = 8000;
const MAX_DIAG_FILES = 6;
const MAX_DIAG_PER_FILE = 10;
const GIT_MAX_BYTES = 24_000;
const GIT_TIMEOUT_MS = 12_000;

function cfgBool(
  config: vscode.WorkspaceConfiguration,
  key: "cloude-code-toolbox.intelligence.includeGitByDefault" | "cloude-code-toolbox.intelligence.includeDiagnosticsByDefault" | "cloude-code-toolbox.intelligence.appendNotepadAfterPack" | "cloude-code-toolbox.intelligence.openChatAfterPack",
  fallback: boolean
): boolean {
  const v = config.get<boolean>(key);
  return v === undefined ? fallback : v;
}

function collectRelativeOpenFiles(folder: vscode.WorkspaceFolder): string[] {
  const seen = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText) {
        const uri = input.uri;
        if (uri.scheme !== "file") {
          continue;
        }
        const rel = vscode.workspace.asRelativePath(uri, false);
        if (rel.startsWith("..") || rel === uri.fsPath) {
          continue;
        }
        if (!seen.has(rel)) {
          seen.add(rel);
        }
      }
    }
  }
  return [...seen];
}

function diagSeverityLabel(s: vscode.DiagnosticSeverity): string {
  switch (s) {
    case vscode.DiagnosticSeverity.Error:
      return "Error";
    case vscode.DiagnosticSeverity.Warning:
      return "Warning";
    case vscode.DiagnosticSeverity.Information:
      return "Info";
    case vscode.DiagnosticSeverity.Hint:
      return "Hint";
    default:
      return "Diag";
  }
}

function formatDiagnosticsForUris(uris: vscode.Uri[]): string | undefined {
  const lines: string[] = [];
  let fileCount = 0;
  for (const uri of uris) {
    if (fileCount >= MAX_DIAG_FILES) {
      break;
    }
    const diags = vscode.languages.getDiagnostics(uri);
    if (diags.length === 0) {
      continue;
    }
    const rel = vscode.workspace.asRelativePath(uri, false);
    lines.push(`### ${rel}`);
    let n = 0;
    for (const d of diags) {
      if (n >= MAX_DIAG_PER_FILE) {
        lines.push(`- _…and ${Math.max(0, diags.length - n)} more_`);
        break;
      }
      const loc = d.range.start.line + 1;
      lines.push(
        `- [${diagSeverityLabel(d.severity)}] L${loc}: ${d.message.split("\n")[0]}`
      );
      n += 1;
    }
    lines.push("");
    fileCount += 1;
  }
  return lines.length ? lines.join("\n").trimEnd() : undefined;
}

function diagnosticTargetUris(folder: vscode.WorkspaceFolder): vscode.Uri[] {
  const seen = new Set<string>();
  const out: vscode.Uri[] = [];
  const push = (u?: vscode.Uri) => {
    if (!u || u.scheme !== "file") {
      return;
    }
    const rel = vscode.workspace.asRelativePath(u, false);
    if (rel.startsWith("..")) {
      return;
    }
    const key = u.toString();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(u);
  };
  push(vscode.window.activeTextEditor?.document.uri);
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        push(tab.input.uri);
      }
    }
  }
  return out;
}

export type ContextPackDeliveryOptions = {
  includeGit: boolean;
  includeDiagnostics: boolean;
  appendNotepad: boolean;
  openChat: boolean;
  /** When false, skip the completion information message (Thinking Machine priming uses its own toast). */
  showCompletionMessage?: boolean;
};

/**
 * Builds markdown parts for the current editor/tabs and optional git/diagnostics sections.
 */
export async function buildContextPackPartsForFolder(
  folder: vscode.WorkspaceFolder,
  includeGit: boolean,
  includeDiagnostics: boolean
): Promise<ContextPackParts> {
  const ed = vscode.window.activeTextEditor;
  let activeFile: ContextPackParts["activeFile"];
  if (ed && ed.document.uri.scheme === "file") {
    const rel = vscode.workspace.asRelativePath(ed.document.uri, false);
    if (!rel.startsWith("..")) {
      const sel = ed.selection.isEmpty ? undefined : ed.document.getText(ed.selection);
      activeFile = {
        relativePath: rel,
        languageId: ed.document.languageId,
        selection: sel,
      };
    }
  }

  const openEditors = collectRelativeOpenFiles(folder);

  let diagnosticsSection: string | undefined;
  if (includeDiagnostics) {
    diagnosticsSection = formatDiagnosticsForUris(diagnosticTargetUris(folder));
  }

  let gitSection: string | undefined;
  if (includeGit) {
    gitSection = await buildGitSection(folder.uri.fsPath, GIT_MAX_BYTES, GIT_TIMEOUT_MS);
  }

  return {
    notice: DEFAULT_PACK_NOTICE,
    workspaceFolderName: folder.name,
    workspaceRootPath: folder.uri.fsPath,
    activeFile,
    openEditorRelativePaths: openEditors,
    diagnosticsSection,
    gitSection,
    limits: {
      maxOpenEditors: MAX_OPEN_EDITORS,
      maxSelectionChars: MAX_SELECTION_CHARS,
    },
  };
}

/**
 * Copies context pack to clipboard; optionally appends notepad, opens Chat, shows toast.
 */
export async function runContextPackDelivery(
  folder: vscode.WorkspaceFolder,
  opts: ContextPackDeliveryOptions
): Promise<void> {
  const parts = await buildContextPackPartsForFolder(
    folder,
    opts.includeGit,
    opts.includeDiagnostics
  );
  const md = buildContextPackMarkdown(parts);
  await vscode.env.clipboard.writeText(md);

  if (opts.appendNotepad) {
    try {
      await appendToSessionNotepad(md);
    } catch {
      vscode.window.showWarningMessage(
        "Cloude Code ToolBox: could not append to session notepad."
      );
    }
  }
  if (opts.openChat) {
    await openClaudeCodePanel();
  }

  if (opts.showCompletionMessage !== false) {
    vscode.window.showInformationMessage(
      `Cloude Code ToolBox: context pack copied.${opts.appendNotepad ? " Appended to session notepad." : ""}${opts.openChat ? " Opened Claude Code." : ""} Review before pasting into Claude Code.`
    );
  }
}

export async function runBuildContextPackFlow(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const config = vscode.workspace.getConfiguration();
  const defGit = cfgBool(config, "cloude-code-toolbox.intelligence.includeGitByDefault", false);
  const defDiag = cfgBool(config, "cloude-code-toolbox.intelligence.includeDiagnosticsByDefault", false);
  const defPad = cfgBool(config, "cloude-code-toolbox.intelligence.appendNotepadAfterPack", false);
  const defChat = cfgBool(config, "cloude-code-toolbox.intelligence.openChatAfterPack", false);

  const picked = await vscode.window.showQuickPick(
    [
      {
        label: "$(git-branch) Include git (branch + diff --stat)",
        description: "May expose branch names and changed paths",
        picked: defGit,
      },
      {
        label: "$(warning) Include diagnostics",
        description: "Summarizes errors/warnings for open editors",
        picked: defDiag,
      },
    ],
    {
      canPickMany: true,
      title: "Cloude Code ToolBox — context pack (optional sections)",
      placeHolder: "Toggle sensitive sections, then press Enter",
    }
  );
  if (picked === undefined) {
    return;
  }
  const includeGit = picked.some((p) => p.label.includes("git"));
  const includeDiag = picked.some((p) => p.label.includes("diagnostics"));

  const follow = await vscode.window.showQuickPick(
    [
      {
        label: "$(notebook) Append pack to session notepad",
        picked: defPad,
      },
      {
        label: "$(comment) Open Claude Code after copy",
        picked: defChat,
      },
    ],
    {
      canPickMany: true,
      title: "Cloude Code ToolBox — after copying",
      placeHolder: "Choose follow-up actions",
    }
  );
  if (follow === undefined) {
    return;
  }
  const appendPad = follow.some((p) => p.label.includes("notepad"));
  const openChat = follow.some((p) => p.label.includes("Chat"));

  await runContextPackDelivery(folder, {
    includeGit,
    includeDiagnostics: includeDiag,
    appendNotepad: appendPad,
    openChat,
    showCompletionMessage: true,
  });
}
