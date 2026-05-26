/**
 * CRUD + discovery for agent team definitions stored as JSON under
 * `~/.claude/teams/*.json` (user scope) and `<workspace>/.claude/teams/*.json`
 * (workspace scope).
 *
 * Teams are lightweight — just a composition of agent names and a protocol.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { atomicWriteText } from "./atomicFile";

export type TeamProtocol =
  | "native-task"
  | "round-robin"
  | "handoff"
  | "plan-then-code"
  | "debate"
  | "orchestrator"
  | "parallel-fan-out"
  | "converge";

export type TeamRuntime = "native" | "custom" | "agent-teams";

export type TeamEntry = {
  id: string;
  name: string;
  description: string;
  protocol: TeamProtocol;
  runtime: TeamRuntime;
  maxTurns: number;
  /** Agent names (match AgentEntry.name). For plan-then-code these are the plan agents. */
  agents: string[];
  /** Code-phase agents for plan-then-code. */
  codePhaseAgents: string[];
  /** Debate/orchestrator special roles. */
  judge?: string;
  orchestrator?: string;
  scope: "user" | "workspace";
  filePath: string;
};

export const USER_TEAM_ROOT_SEGMENTS = [".claude", "teams"] as const;
export const WORKSPACE_TEAM_ROOT_SEGMENTS = [".claude", "teams"] as const;

export type TeamDraft = Omit<TeamEntry, "id" | "filePath">;

export class TeamsStoreError extends Error {}

const PROTOCOLS: readonly TeamProtocol[] = [
  "native-task",
  "round-robin",
  "handoff",
  "plan-then-code",
  "debate",
  "orchestrator",
  "parallel-fan-out",
  "converge",
];

/** Which runtime a protocol needs. */
export function runtimeForProtocol(p: TeamProtocol): TeamRuntime {
  if (p === "native-task" || p === "round-robin" || p === "handoff") {
    return "native";
  }
  return "custom";
}

function sanitizeTeamFileBase(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new TeamsStoreError("Team name must contain letters, digits, or dashes.");
  }
  return cleaned;
}

export function teamsDirForScope(
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string
): string | undefined {
  if (scope === "user") {
    return path.join(homeDir, ...USER_TEAM_ROOT_SEGMENTS);
  }
  return workspaceRoot ? path.join(workspaceRoot, ...WORKSPACE_TEAM_ROOT_SEGMENTS) : undefined;
}

function normalizeProtocol(raw: unknown): TeamProtocol {
  if (typeof raw === "string" && (PROTOCOLS as readonly string[]).includes(raw)) {
    return raw as TeamProtocol;
  }
  return "native-task";
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

async function readTeamFile(filePath: string, scope: "user" | "workspace"): Promise<TeamEntry | undefined> {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const name = typeof raw.name === "string" && raw.name ? raw.name : path.basename(filePath, ".json");
  const description = typeof raw.description === "string" ? raw.description : "";
  const protocol = normalizeProtocol(raw.protocol);
  const runtime =
    raw.runtime === "native" || raw.runtime === "custom" || raw.runtime === "agent-teams"
      ? (raw.runtime as TeamRuntime)
      : runtimeForProtocol(protocol);
  const maxTurnsRaw = typeof raw.maxTurns === "number" ? raw.maxTurns : 20;
  const maxTurns = Math.max(1, Math.min(100, Math.floor(maxTurnsRaw)));
  const agents = normalizeStringArray(raw.agents ?? raw.plan_phase_agents);
  const codePhaseAgents = normalizeStringArray(raw.codePhaseAgents ?? raw.code_phase_agents);
  const judge = typeof raw.judge === "string" && raw.judge ? raw.judge : undefined;
  const orchestrator =
    typeof raw.orchestrator === "string" && raw.orchestrator ? raw.orchestrator : undefined;
  return {
    id: `${scope}:${path.normalize(filePath).toLowerCase()}`,
    name,
    description,
    protocol,
    runtime,
    maxTurns,
    agents,
    codePhaseAgents,
    judge,
    orchestrator,
    scope,
    filePath,
  };
}

async function scanTeamsUnderRoot(root: string, scope: "user" | "workspace"): Promise<TeamEntry[]> {
  const out: TeamEntry[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile() || !/\.json$/i.test(e.name)) {
      continue;
    }
    const team = await readTeamFile(path.join(root, e.name), scope);
    if (team) {
      out.push(team);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function collectLocalTeams(
  homeDir: string,
  workspaceRoot?: string
): Promise<TeamEntry[]> {
  const seen = new Set<string>();
  const merged: TeamEntry[] = [];
  const push = (list: TeamEntry[]) => {
    for (const t of list) {
      if (seen.has(t.id)) {
        continue;
      }
      seen.add(t.id);
      merged.push(t);
    }
  };
  if (workspaceRoot) {
    push(await scanTeamsUnderRoot(path.join(workspaceRoot, ...WORKSPACE_TEAM_ROOT_SEGMENTS), "workspace"));
  }
  push(await scanTeamsUnderRoot(path.join(homeDir, ...USER_TEAM_ROOT_SEGMENTS), "user"));
  return merged;
}

function serializeTeam(draft: TeamDraft): string {
  return `${JSON.stringify(
    {
      name: draft.name.trim(),
      description: draft.description.trim(),
      protocol: draft.protocol,
      runtime: draft.runtime,
      maxTurns: draft.maxTurns,
      agents: draft.agents,
      codePhaseAgents: draft.codePhaseAgents,
      judge: draft.judge,
      orchestrator: draft.orchestrator,
    },
    null,
    2
  )}\n`;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await atomicWriteText(filePath, content);
}

export async function createTeam(
  draft: TeamDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<TeamEntry> {
  const dir = teamsDirForScope(draft.scope, homeDir, workspaceRoot);
  if (!dir) {
    throw new TeamsStoreError("Open a workspace folder to save workspace-scope teams.");
  }
  const base = sanitizeTeamFileBase(draft.name);
  const target = path.join(dir, `${base}.json`);
  try {
    await fs.access(target);
    throw new TeamsStoreError(`Team "${base}.json" already exists in ${draft.scope} scope.`);
  } catch (e) {
    if (e instanceof TeamsStoreError) {
      throw e;
    }
  }
  await atomicWrite(target, serializeTeam(draft));
  const team = await readTeamFile(target, draft.scope);
  if (!team) {
    throw new TeamsStoreError(`Team saved but not readable back: ${target}`);
  }
  return team;
}

export async function updateTeam(
  existing: TeamEntry,
  draft: TeamDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<TeamEntry> {
  if (existing.scope !== draft.scope) {
    throw new TeamsStoreError("Scope change is not supported — delete and re-create instead.");
  }
  const currentBase = path.basename(existing.filePath, ".json");
  const newBase = sanitizeTeamFileBase(draft.name);
  const dir = path.dirname(existing.filePath);
  const targetPath = path.join(dir, `${newBase}.json`);
  if (currentBase !== newBase) {
    try {
      await fs.access(targetPath);
      throw new TeamsStoreError(`Team "${newBase}.json" already exists in this scope.`);
    } catch (e) {
      if (e instanceof TeamsStoreError) {
        throw e;
      }
    }
  }
  await atomicWrite(targetPath, serializeTeam(draft));
  if (path.normalize(targetPath).toLowerCase() !== path.normalize(existing.filePath).toLowerCase()) {
    try {
      await fs.unlink(existing.filePath);
    } catch {
      /* already gone */
    }
  }
  const team = await readTeamFile(targetPath, draft.scope);
  if (!team) {
    throw new TeamsStoreError(`Team updated but not readable back: ${targetPath}`);
  }
  return team;
}

export async function deleteTeam(team: TeamEntry): Promise<void> {
  try {
    await fs.unlink(team.filePath);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === "ENOENT") {
      return;
    }
    throw new TeamsStoreError(`Could not delete ${team.filePath}: ${err?.message ?? String(e)}`);
  }
}
