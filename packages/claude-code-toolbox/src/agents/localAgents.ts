/**
 * Discover Claude Code subagent definitions on disk.
 *
 * Claude Code's native subagent format is a YAML-frontmatter `.md` file under
 * `~/.claude/agents/` (user scope) or `<workspace>/.claude/agents/` (workspace
 * scope). Required frontmatter keys: `name`, `description`. Optional: `model`,
 * `tools`, plus our own `role` and `color` extensions.
 *
 * Cross-platform: paths are built with `path.join`; frontmatter newline
 * handling accepts both `\n` and `\r\n`.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const USER_AGENT_ROOT_SEGMENTS = [".claude", "agents"] as const;
export const WORKSPACE_AGENT_ROOT_SEGMENTS = [".claude", "agents"] as const;

export type AgentRole = "plan" | "code" | "review" | "both";

export type AgentEntry = {
  /** Stable id: `<scope>:<abs-file-path>` (case-folded for dedup). */
  id: string;
  /** Agent name from frontmatter; falls back to the file basename. */
  name: string;
  description: string;
  role: AgentRole;
  /** Model slug as written in frontmatter. Empty = inherit caller's default. */
  model: string;
  tools: string[];
  /** Hex color for transcript border. Deterministic hash fallback when absent. */
  color: string;
  /** Absolute path to the agent markdown file. */
  filePath: string;
  /** Body of the agent file after the frontmatter (the system prompt). */
  systemPrompt: string;
  scope: "user" | "workspace";
  /** Hub-only: user hid it in the hub (file still on disk). */
  disabled?: boolean;
};

const DEFAULT_COLORS = [
  "#4ec9b0", // teal
  "#c586c0", // magenta
  "#9cdcfe", // sky
  "#ce9178", // amber
  "#b5cea8", // green
  "#dcdcaa", // sand
  "#569cd6", // blue
  "#f48771", // coral
  "#d7ba7d", // beige
];

/** Deterministic color from name for agents that don't declare one. */
export function colorForAgentName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_COLORS[h % DEFAULT_COLORS.length];
}

function splitFrontmatter(text: string): { fm: string; body: string } {
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) {
    return { fm: "", body: text };
  }
  return { fm: m[1], body: m[2] };
}

function parseListValue(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Minimal YAML reader for a flat key: value map with optional inline arrays. */
export function parseAgentFrontmatter(fm: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!fm) {
    return out;
  }
  const lines = fm.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) {
      continue;
    }
    const key = m[1].toLowerCase();
    const raw = m[2];
    if (key === "tools") {
      out[key] = parseListValue(raw);
      continue;
    }
    const v = raw.trim().replace(/^["']|["']$/g, "");
    out[key] = v;
  }
  return out;
}

function normalizeRole(raw: unknown): AgentRole {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  if (v === "plan" || v === "code" || v === "review" || v === "both") {
    return v;
  }
  return "both";
}

async function readAgentFile(filePath: string, scope: "user" | "workspace"): Promise<AgentEntry | undefined> {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  const { fm, body } = splitFrontmatter(text);
  const parsed = parseAgentFrontmatter(fm);
  const name = typeof parsed.name === "string" && parsed.name
    ? parsed.name
    : path.basename(filePath).replace(/\.md$/i, "");
  const description = typeof parsed.description === "string" ? parsed.description.slice(0, 280) : "";
  const role = normalizeRole(parsed.role);
  const model = typeof parsed.model === "string" ? parsed.model : "";
  const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
  const declaredColor = typeof parsed.color === "string" ? parsed.color.trim() : "";
  const color = /^#[0-9a-fA-F]{3,8}$/.test(declaredColor) ? declaredColor : colorForAgentName(name);
  return {
    id: `${scope}:${path.normalize(filePath).toLowerCase()}`,
    name,
    description,
    role,
    model,
    tools,
    color,
    filePath,
    systemPrompt: body.trim(),
    scope,
  };
}

async function scanAgentsUnderRoot(root: string, scope: "user" | "workspace"): Promise<AgentEntry[]> {
  const out: AgentEntry[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile()) {
      continue;
    }
    if (!/\.md$/i.test(e.name)) {
      continue;
    }
    const agent = await readAgentFile(path.join(root, e.name), scope);
    if (agent) {
      out.push(agent);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Collect agent entries from workspace (if any) then user scope.
 * Workspace entries win on duplicate id (same absolute path).
 */
export async function collectLocalAgents(
  homeDir: string,
  workspaceRoot?: string
): Promise<AgentEntry[]> {
  const seen = new Set<string>();
  const merged: AgentEntry[] = [];

  if (workspaceRoot) {
    const wsRoot = path.join(workspaceRoot, ...WORKSPACE_AGENT_ROOT_SEGMENTS);
    const found = await scanAgentsUnderRoot(wsRoot, "workspace");
    for (const a of found) {
      if (seen.has(a.id)) {
        continue;
      }
      seen.add(a.id);
      merged.push(a);
    }
  }

  const userRoot = path.join(homeDir, ...USER_AGENT_ROOT_SEGMENTS);
  const found = await scanAgentsUnderRoot(userRoot, "user");
  for (const a of found) {
    if (seen.has(a.id)) {
      continue;
    }
    seen.add(a.id);
    merged.push(a);
  }

  return merged;
}

export function agentsDirForScope(
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string
): string | undefined {
  if (scope === "user") {
    return path.join(homeDir, ...USER_AGENT_ROOT_SEGMENTS);
  }
  return workspaceRoot ? path.join(workspaceRoot, ...WORKSPACE_AGENT_ROOT_SEGMENTS) : undefined;
}
