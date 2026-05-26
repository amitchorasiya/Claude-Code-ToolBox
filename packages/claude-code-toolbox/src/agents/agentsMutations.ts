/**
 * CRUD for Claude Code subagent files under `~/.claude/agents/*.md` and
 * `<workspace>/.claude/agents/*.md`.
 *
 * Writes are atomic: temp file + `fs.rename` on the same volume.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentEntry, AgentRole } from "./localAgents";
import { agentsDirForScope, collectLocalAgents, colorForAgentName } from "./localAgents";
import { atomicWriteText } from "./atomicFile";

export type AgentDraft = {
  name: string;
  description: string;
  role: AgentRole;
  model?: string;
  tools?: string[];
  color?: string;
  systemPrompt: string;
  skillPath?: string;
  scope: "user" | "workspace";
  longTermMemory?: boolean;
};

export class AgentsMutationError extends Error {}

export function memoryPathForAgent(agentFilePath: string): string {
  return agentFilePath.replace(/\.md$/i, ".memory.md");
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new AgentsMutationError("Agent name must contain letters, digits, or dashes.");
  }
  return cleaned;
}

function escapeYamlScalar(value: string): string {
  if (value === "") {
    return '""';
  }
  if (/^[A-Za-z0-9 _./,:;@#?!+-]+$/.test(value) && !/^[\s-]/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function renderTools(tools: string[] | undefined): string {
  if (!tools || tools.length === 0) {
    return "[]";
  }
  return `[${tools.map((t) => escapeYamlScalar(t)).join(", ")}]`;
}

/** Serialize an agent draft back into the native YAML-frontmatter `.md` format. */
export function renderAgentMarkdown(draft: AgentDraft): string {
  const name = draft.name.trim();
  const color =
    draft.color && /^#[0-9a-fA-F]{3,8}$/.test(draft.color.trim())
      ? draft.color.trim()
      : colorForAgentName(name);
  const lines: string[] = ["---"];
  lines.push(`name: ${escapeYamlScalar(name)}`);
  lines.push(`description: ${escapeYamlScalar(draft.description.trim())}`);
  lines.push(`role: ${draft.role}`);
  if (draft.model && draft.model.trim()) {
    lines.push(`model: ${escapeYamlScalar(draft.model.trim())}`);
  }
  lines.push(`tools: ${renderTools(draft.tools)}`);
  lines.push(`color: ${escapeYamlScalar(color)}`);
  if (draft.skillPath && draft.skillPath.trim()) {
    lines.push(`skillPath: ${escapeYamlScalar(draft.skillPath.trim())}`);
  }
  if (draft.longTermMemory) {
    lines.push(`longTermMemory: true`);
  }
  lines.push("---");
  lines.push("");
  lines.push(draft.systemPrompt.trim());
  if (draft.longTermMemory) {
    const slug = sanitizeFileName(name);
    lines.push("");
    lines.push("## Long-term memory");
    lines.push("");
    lines.push(`You have a persistent memory file at \`~/.claude/agents/${slug}.memory.md\`.`);
    lines.push("Read it at the start of your task to recall past learnings.");
    lines.push("After completing your task, append a new entry under today's date (### YYYY-MM-DD) with:");
    lines.push("- **What I did:** brief journal of actions");
    lines.push("- **What worked:** successful approaches");
    lines.push("- **What to avoid:** mistakes or rejected approaches");
    lines.push("- **User preferences:** observed style/format preferences");
    lines.push("- **Role insights:** what makes you better at this role");
    lines.push("");
    lines.push("Focus on becoming smarter at YOUR role, not storing project facts.");
  }
  lines.push("");
  return lines.join("\n");
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await atomicWriteText(filePath, content);
}

async function resolveAgentDir(
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string
): Promise<string> {
  const dir = agentsDirForScope(scope, homeDir, workspaceRoot);
  if (!dir) {
    throw new AgentsMutationError("Open a workspace folder to save workspace-scope agents.");
  }
  return dir;
}

export async function createAgent(
  draft: AgentDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<AgentEntry> {
  const dir = await resolveAgentDir(draft.scope, homeDir, workspaceRoot);
  const base = sanitizeFileName(draft.name);
  const target = path.join(dir, `${base}.md`);
  try {
    await fs.access(target);
    throw new AgentsMutationError(`Agent "${base}.md" already exists in ${draft.scope} scope.`);
  } catch (e) {
    if (e instanceof AgentsMutationError) {
      throw e;
    }
    /* not found → ok */
  }
  await atomicWrite(target, renderAgentMarkdown(draft));
  const found = await collectLocalAgents(homeDir, workspaceRoot);
  const created = found.find((a) => path.normalize(a.filePath).toLowerCase() === path.normalize(target).toLowerCase());
  if (!created) {
    throw new AgentsMutationError(`Agent created but not found back on disk: ${target}`);
  }
  return created;
}

export async function updateAgent(
  existing: AgentEntry,
  draft: AgentDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<AgentEntry> {
  if (existing.scope !== draft.scope) {
    throw new AgentsMutationError("Scope change is not supported — delete and re-create instead.");
  }
  const currentBase = path.basename(existing.filePath).replace(/\.md$/i, "");
  const newBase = sanitizeFileName(draft.name);
  const dir = path.dirname(existing.filePath);
  const targetPath = path.join(dir, `${newBase}.md`);
  if (currentBase !== newBase) {
    try {
      await fs.access(targetPath);
      throw new AgentsMutationError(`Agent "${newBase}.md" already exists in this scope.`);
    } catch (e) {
      if (e instanceof AgentsMutationError) {
        throw e;
      }
      /* not found → ok */
    }
  }
  await atomicWrite(targetPath, renderAgentMarkdown(draft));
  if (path.normalize(targetPath).toLowerCase() !== path.normalize(existing.filePath).toLowerCase()) {
    try {
      await fs.unlink(existing.filePath);
    } catch {
      /* already gone */
    }
    try {
      await fs.rename(memoryPathForAgent(existing.filePath), memoryPathForAgent(targetPath));
    } catch {
      /* no memory file to rename */
    }
  }
  const found = await collectLocalAgents(homeDir, workspaceRoot);
  const updated = found.find(
    (a) => path.normalize(a.filePath).toLowerCase() === path.normalize(targetPath).toLowerCase()
  );
  if (!updated) {
    throw new AgentsMutationError(`Agent updated but not found back on disk: ${targetPath}`);
  }
  return updated;
}

export async function deleteAgent(agent: AgentEntry): Promise<void> {
  try {
    await fs.unlink(agent.filePath);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === "ENOENT") {
      return;
    }
    throw new AgentsMutationError(`Could not delete ${agent.filePath}: ${err?.message ?? String(e)}`);
  }
  try {
    await fs.unlink(memoryPathForAgent(agent.filePath));
  } catch {
    /* no memory file */
  }
}
