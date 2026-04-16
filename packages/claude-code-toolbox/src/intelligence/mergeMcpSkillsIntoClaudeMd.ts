import * as vscode from "vscode";
import {
  buildMcpSkillsAwarenessInstructionsBlock,
  replaceOrAppendAwarenessBlock,
} from "./mergeMcpSkillsIntoClaudeMdCore";

export {
  MCP_SKILLS_AWARENESS_BANNER_END,
  MCP_SKILLS_AWARENESS_BANNER_START,
  buildMcpSkillsAwarenessInstructionsBlock,
  replaceOrAppendAwarenessBlock,
} from "./mergeMcpSkillsIntoClaudeMdCore";

/**
 * Writes or updates `CLAUDE.md` at workspace root with a replaceable MCP & skills block.
 */
export async function mergeMcpSkillsAwarenessIntoClaudeMd(
  folder: vscode.WorkspaceFolder,
  innerMarkdown: string
): Promise<void> {
  const outUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");

  const block = buildMcpSkillsAwarenessInstructionsBlock(innerMarkdown);

  let existing = "";
  try {
    const doc = await vscode.workspace.fs.readFile(outUri);
    existing = new TextDecoder().decode(doc);
  } catch {
    /* new file */
  }

  const next = replaceOrAppendAwarenessBlock(existing, block);
  await vscode.workspace.fs.writeFile(outUri, new TextEncoder().encode(next));
}
