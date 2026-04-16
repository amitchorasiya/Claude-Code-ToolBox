import * as vscode from "vscode";
import type { SkillEntry } from "./localSkills";

const WS_KEY = "CloudeCodeToolBox.skills.hubDisabledIds.workspace";
const USER_KEY = "CloudeCodeToolBox.skills.hubDisabledIds.user";

function getIds(context: vscode.ExtensionContext, scope: "workspace" | "user"): string[] {
  const raw =
    scope === "workspace"
      ? context.workspaceState.get<unknown>(WS_KEY)
      : context.globalState.get<unknown>(USER_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

async function setIds(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  ids: string[]
): Promise<void> {
  if (scope === "workspace") {
    await context.workspaceState.update(WS_KEY, ids);
  } else {
    await context.globalState.update(USER_KEY, ids);
  }
}

export function isSkillHubDisabled(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  skillId: string
): boolean {
  return getIds(context, scope).includes(skillId);
}

export async function setSkillHubDisabled(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  skillId: string
): Promise<void> {
  const ids = getIds(context, scope);
  if (!ids.includes(skillId)) {
    ids.push(skillId);
    await setIds(context, scope, ids);
  }
}

export async function setSkillHubEnabled(
  context: vscode.ExtensionContext,
  scope: "workspace" | "user",
  skillId: string
): Promise<void> {
  const next = getIds(context, scope).filter((id) => id !== skillId);
  await setIds(context, scope, next);
}

/** Remove id from both lists (e.g. after folder delete). */
export async function clearSkillHubDisabledEverywhere(
  context: vscode.ExtensionContext,
  skillId: string
): Promise<void> {
  await setSkillHubEnabled(context, "workspace", skillId);
  await setSkillHubEnabled(context, "user", skillId);
}

/** Drop disabled ids that no longer match any discovered skill. */
export async function pruneStaleHubDisabledSkillIds(
  context: vscode.ExtensionContext,
  validSkillIds: Set<string>
): Promise<void> {
  for (const scope of ["workspace", "user"] as const) {
    const list = getIds(context, scope);
    const next = list.filter((id) => validSkillIds.has(id));
    if (next.length !== list.length) {
      await setIds(context, scope, next);
    }
  }
}

/** Prune stale ids, then set `disabled` from hub state (folder unchanged on disk). */
export async function applyHubDisabledFlagsToSkills(
  context: vscode.ExtensionContext,
  skills: SkillEntry[]
): Promise<SkillEntry[]> {
  const validIds = new Set(skills.map((s) => s.id));
  await pruneStaleHubDisabledSkillIds(context, validIds);
  return skills.map((s) => ({
    ...s,
    disabled: isSkillHubDisabled(context, s.scope, s.id),
  }));
}
