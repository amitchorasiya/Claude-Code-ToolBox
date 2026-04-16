import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import { evaluateReadiness, formatReadinessMarkdown } from "./readiness";
import { gatherReadinessInput } from "./buildReadinessInput";

export async function showIntelligenceReadiness(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const input = await gatherReadinessInput(folder);
  const checks = evaluateReadiness(input);
  const md = formatReadinessMarkdown(checks);
  const doc = await vscode.workspace.openTextDocument({
    content: md,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
  const next = await vscode.window.showInformationMessage(
    "Cloude Code ToolBox: readiness summary opened.",
    "MCP & Skills scan",
    "Open workspace mcp.json"
  );
  if (next === "MCP & Skills scan") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.showMcpSkillsAwareness");
  } else if (next === "Open workspace mcp.json") {
    await vscode.commands.executeCommand("CloudeCodeToolBox.openWorkspaceMcp");
  }
}
