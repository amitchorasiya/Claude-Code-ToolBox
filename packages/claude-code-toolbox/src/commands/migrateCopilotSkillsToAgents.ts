import * as os from "node:os";
import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import type { MigrateSkillMode } from "../skills/migrateCursorSkillsToAgents";
import {
  runCopilotGithubSkillsMigrationForRoot,
  runCopilotUserSkillsMigrationForRoot,
} from "../skills/migrateCursorSkillsToAgents";

type ScopePick = { label: string; description: string; value: "workspace" | "user" | "both"; alwaysShow: true };

/**
 * Migrate `.github/skills` and/or `~/.copilot/skills` into `.agents/skills` (same layout as Cursor skill migration).
 */
export async function migrateCopilotSkillsToAgents(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  const home = os.homedir();

  const scopeChoices: ScopePick[] = [
    {
      label: "User only (~/.copilot/skills → ~/.agents/skills)",
      description: "Personal Copilot-style skills in your home directory",
      value: "user",
      alwaysShow: true,
    },
  ];
  if (folder) {
    scopeChoices.unshift({
      label: "Workspace only (.github/skills → .agents/skills)",
      description: `Folder: ${folder.name}`,
      value: "workspace",
      alwaysShow: true,
    });
    scopeChoices.push({
      label: "Workspace + user",
      description: "Run both migrations",
      value: "both",
      alwaysShow: true,
    });
  }

  const scope = await vscode.window.showQuickPick(scopeChoices, {
    title: "Migrate skills: GitHub/Copilot → .agents",
    placeHolder: "Choose scope",
  });
  if (!scope) {
    return;
  }

  const modePick = await vscode.window.showQuickPick(
    [
      {
        label: "Copy",
        description: "Keep originals under .github/skills or ~/.copilot/skills",
        value: "copy" as const,
        alwaysShow: true as const,
      },
      {
        label: "Move",
        description: "Copy to .agents/skills then delete from source",
        value: "move" as const,
        alwaysShow: true as const,
      },
    ],
    { title: "Copy or move?", placeHolder: "Copy is safer" }
  );
  if (!modePick) {
    return;
  }
  const mode: MigrateSkillMode = modePick.value;

  const lines: string[] = [];
  let totalM = 0;
  let totalS = 0;
  let totalE = 0;

  if (scope.value === "workspace" || scope.value === "both") {
    if (!folder) {
      vscode.window.showErrorMessage("Open a workspace folder first.");
      return;
    }
    const run = await runCopilotGithubSkillsMigrationForRoot(folder.uri.fsPath, mode);
    totalM += run.migrated;
    totalS += run.skipped;
    totalE += run.errors;
    if (run.found === 0) {
      lines.push(`No SKILL.md skills under ${run.skillsSourcePath}`);
    } else {
      lines.push(
        `${run.skillsSourcePath}: migrated ${run.migrated}, skipped ${run.skipped}, errors ${run.errors}`
      );
    }
  }
  if (scope.value === "user" || scope.value === "both") {
    const run = await runCopilotUserSkillsMigrationForRoot(home, mode);
    totalM += run.migrated;
    totalS += run.skipped;
    totalE += run.errors;
    if (run.found === 0) {
      lines.push(`No SKILL.md skills under ${run.skillsSourcePath}`);
    } else {
      lines.push(
        `${run.skillsSourcePath}: migrated ${run.migrated}, skipped ${run.skipped}, errors ${run.errors}`
      );
    }
  }

  await vscode.commands.executeCommand("CloudeCodeToolBox.refreshMcpView");

  const summary = `Copilot/GitHub skills → .agents: ${totalM} migrated, ${totalS} skipped, ${totalE} errors.`;
  if (totalE > 0) {
    await vscode.window.showWarningMessage(`${summary} ${lines.join(" · ")}`);
  } else if (totalM === 0 && totalS === 0) {
    await vscode.window.showInformationMessage(
      `${summary} No skill folders with SKILL.md under .github/skills or ~/.copilot/skills for this scope.`
    );
  } else {
    await vscode.window.showInformationMessage(`${summary} ${lines.join(" · ")}`);
  }
}
