import * as vscode from "vscode";

/** Written under `.claude/` on each MCP & Skills scan (overwritten). */
export const MCP_SKILLS_AWARENESS_FILENAME = "cloude-code-toolbox-mcp-skills-awareness.md";

export const MCP_SKILLS_AWARENESS_RELATIVE = `.claude/${MCP_SKILLS_AWARENESS_FILENAME}`;

/**
 * Overwrites the workspace awareness markdown (creates `.claude` if needed).
 */
export async function writeMcpSkillsAwarenessWorkspaceFile(
  folder: vscode.WorkspaceFolder,
  markdown: string
): Promise<void> {
  const dir = vscode.Uri.joinPath(folder.uri, ".claude");
  try {
    await vscode.workspace.fs.stat(dir);
  } catch {
    await vscode.workspace.fs.createDirectory(dir);
  }
  const uri = vscode.Uri.joinPath(dir, MCP_SKILLS_AWARENESS_FILENAME);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(markdown));
}
