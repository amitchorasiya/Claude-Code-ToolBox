import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { gatherHubPayload } from "../webview/mcpSkillsHubView";
import {
  MCP_SKILLS_AWARENESS_FILENAME,
  MCP_SKILLS_AWARENESS_RELATIVE,
  writeMcpSkillsAwarenessWorkspaceFile,
} from "./awarenessWorkspaceFile";
import {
  formatMcpSkillsAwarenessMarkdown,
  formatMcpSkillsClaudeMdBlock,
} from "./formatMcpSkillsAwareness";
import { mergeMcpSkillsAwarenessIntoClaudeMd } from "./mergeMcpSkillsIntoClaudeMd";

const AUTO_SCAN_MERGE_INSTRUCTIONS =
  "cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen";

/**
 * Refreshes MCP & Skills awareness: always saves the full report under `.claude/` (overwritten each run).
 * Merges a compact block into `CLAUDE.md` when: the scan is interactive (not silent),
 * **or** workspace auto-scan is enabled, **or** `forceMergeIntoInstructions` is true (e.g. One Click “merge once”).
 */
export async function showMcpSkillsAwareness(
  context: vscode.ExtensionContext,
  options?: { silentNotification?: boolean; forceMergeIntoInstructions?: boolean }
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const folder = mcpPaths.getPrimaryWorkspaceFolder();

  const payload = await gatherHubPayload(context);
  const userMcpPath = mcpPaths.userMcpJsonPath(insiders);
  const workspaceMcpPath = folder ? mcpPaths.workspaceMcpUri(folder).fsPath : undefined;

  const pathOpts = {
    userMcpPath,
    workspaceMcpPath,
    workspaceName: payload.workspaceName,
  };

  const md = formatMcpSkillsAwarenessMarkdown(payload, pathOpts);

  if (!folder) {
    if (!options?.silentNotification) {
      void vscode.window.showWarningMessage(
        "MCP & Skills awareness: open a workspace folder to save the report and update instructions."
      );
    }
    return;
  }

  try {
    await writeMcpSkillsAwarenessWorkspaceFile(folder, md);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Cloude Code ToolBox] write awareness file failed:", msg);
    if (!options?.silentNotification) {
      void vscode.window.showErrorMessage(`Could not write ${MCP_SKILLS_AWARENESS_RELATIVE}: ${msg}`);
    }
    return;
  }

  const autoScanOn = cfg.get<boolean>(AUTO_SCAN_MERGE_INSTRUCTIONS) === true;
  const shouldMergeIntoInstructions =
    options?.silentNotification !== true ||
    autoScanOn ||
    options?.forceMergeIntoInstructions === true;

  if (shouldMergeIntoInstructions) {
    try {
      const instructionsMd = formatMcpSkillsClaudeMdBlock(payload, pathOpts);
      await mergeMcpSkillsAwarenessIntoClaudeMd(folder, instructionsMd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Cloude Code ToolBox] merge into CLAUDE.md failed:", msg);
      if (!options?.silentNotification) {
        void vscode.window.showWarningMessage(`Could not update CLAUDE.md: ${msg}`);
      }
    }
  }

  if (!options?.silentNotification) {
    const openPath = vscode.Uri.joinPath(folder.uri, ".claude", MCP_SKILLS_AWARENESS_FILENAME);
    const next = await vscode.window.showInformationMessage(
      `MCP & Skills awareness saved to ${MCP_SKILLS_AWARENESS_RELATIVE}. Claude Code reads \`CLAUDE.md\` when auto-merge is on; open the report only if you want to read it.`,
      "Open report",
      "Open workspace mcp.json",
      "Readiness summary"
    );
    if (next === "Open report") {
      await vscode.window.showTextDocument(openPath, { preview: true });
    } else if (next === "Open workspace mcp.json") {
      await vscode.commands.executeCommand("CloudeCodeToolBox.openWorkspaceMcp");
    } else if (next === "Readiness summary") {
      await vscode.commands.executeCommand("CloudeCodeToolBox.showIntelligenceReadiness");
    }
  }
}
