import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  USER_SKILL_ROOT_SEGMENTS,
  WORKSPACE_SKILL_ROOT_SEGMENTS,
} from "../skills/localSkills";
import { clearSkillHubDisabledEverywhere } from "../skills/skillHubState";
import * as mcpPaths from "../mcpPaths";

function isUnderSkillRoot(
  normalizedSkillRoot: string,
  baseRoot: string,
  segmentsList: readonly (readonly string[])[]
): boolean {
  for (const segs of segmentsList) {
    const base = path.normalize(path.join(baseRoot, ...segs));
    if (normalizedSkillRoot.startsWith(base + path.sep) && normalizedSkillRoot !== base) {
      return true;
    }
  }
  return false;
}

/** Delete a discovered skill folder (must sit under known user or workspace skill roots). */
export async function deleteSkillFolderFromHub(
  context: vscode.ExtensionContext,
  rootPath: string,
  scope: "workspace" | "user"
): Promise<void> {
  const normalized = path.normalize(rootPath);
  const skillId = `${scope}:${normalized}`;
  const home = path.normalize(os.homedir());

  let allowed = false;
  if (scope === "workspace") {
    const folder = mcpPaths.getPrimaryWorkspaceFolder();
    if (folder) {
      allowed = isUnderSkillRoot(normalized, path.normalize(folder.uri.fsPath), WORKSPACE_SKILL_ROOT_SEGMENTS);
    }
  } else {
    allowed = isUnderSkillRoot(normalized, home, USER_SKILL_ROOT_SEGMENTS);
  }

  if (!allowed) {
    vscode.window.showErrorMessage(
      "Refusing to delete: folder is not under a known skill root (.github/skills, .agents/skills, etc.)."
    );
    return;
  }

  const ok = await vscode.window.showWarningMessage(
    `Move this skill folder to trash (or delete)?\n${rootPath}`,
    { modal: true },
    "Delete",
    "Cancel"
  );
  if (ok !== "Delete") {
    return;
  }

  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(rootPath), { recursive: true, useTrash: true });
    await clearSkillHubDisabledEverywhere(context, skillId);
    vscode.window.showInformationMessage("Skill folder removed.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`Could not delete skill folder: ${msg}`);
  }
}
