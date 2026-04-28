/**
 * CRUD for Claude Code custom slash commands under `~/.claude/commands/*.md`
 * and `<workspace>/.claude/commands/*.md`.
 *
 * Follows the same atomic-write pattern as agentsMutations.ts.
 * Command files use YAML frontmatter (description, argument-hint) + a body
 * that instructs Claude to dispatch agents via the Task tool.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  COMMANDS_PACK_MARKER,
  commandsDirForScope,
  listInstalledCommands,
  type InstalledCommand,
} from "./commandsPack";
import { atomicWriteText } from "./atomicFile";

export type CommandDraft = {
  name: string;
  description: string;
  argumentHint: string;
  agents: string[];
  instructions: string;
  scope: "user" | "workspace";
};

export class CommandMutationError extends Error {}

function sanitizeCommandName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new CommandMutationError(
      "Command name must contain letters, digits, or dashes."
    );
  }
  return cleaned;
}

function escapeYamlScalar(s: string): string {
  if (s === "") return '""';
  const needsQuote =
    /[:\-?#*&!|>'"%@`,\[\]{}\n]/.test(s) || /^\s|\s$/.test(s);
  if (!needsQuote) return s;
  return JSON.stringify(s);
}

/**
 * Build the command body from selected agents and optional custom instructions.
 * If `instructions` is non-empty, use it as-is (user-authored body).
 * Otherwise generate a standard Task-dispatch template from the agent list.
 */
function buildCommandBody(
  agents: string[],
  instructions: string
): string {
  if (instructions.trim()) {
    return instructions.trim();
  }
  if (!agents.length) {
    return "User's request:\n$ARGUMENTS";
  }
  const lines: string[] = [
    "You have access to these custom subagents. Use the **Task** tool to dispatch work to them, one at a time, in this order:",
    "",
  ];
  agents.forEach((a, i) => {
    lines.push(`${i + 1}. \`${a}\``);
  });
  lines.push("");
  lines.push(
    "After all agents have replied, synthesize their outputs into a coherent response."
  );
  lines.push("");
  lines.push("User's request:");
  lines.push("$ARGUMENTS");
  return lines.join("\n");
}

export function renderCommandMarkdown(draft: CommandDraft): string {
  const body = buildCommandBody(draft.agents, draft.instructions);
  return [
    "---",
    `description: ${escapeYamlScalar(draft.description.trim())}`,
    `argument-hint: ${escapeYamlScalar(draft.argumentHint.trim())}`,
    "---",
    COMMANDS_PACK_MARKER,
    "",
    body,
    "",
  ].join("\n");
}

async function resolveCommandDir(
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string
): Promise<string> {
  const dir = commandsDirForScope(scope, homeDir, workspaceRoot);
  if (!dir) {
    throw new CommandMutationError(
      "Open a workspace folder to save workspace-scope commands."
    );
  }
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function createCommand(
  draft: CommandDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<InstalledCommand> {
  const dir = await resolveCommandDir(draft.scope, homeDir, workspaceRoot);
  const base = sanitizeCommandName(draft.name);
  const target = path.join(dir, `${base}.md`);
  try {
    await fs.access(target);
    throw new CommandMutationError(
      `Command "${base}.md" already exists in ${draft.scope} scope.`
    );
  } catch (e) {
    if (e instanceof CommandMutationError) throw e;
  }
  await atomicWriteText(target, renderCommandMarkdown(draft));
  const all = await listInstalledCommands(homeDir, workspaceRoot);
  const created = all.find(
    (c) =>
      path.normalize(c.filePath).toLowerCase() ===
      path.normalize(target).toLowerCase()
  );
  if (!created) {
    throw new CommandMutationError(
      `Command created but not found back on disk: ${target}`
    );
  }
  return created;
}

export async function updateCommand(
  existing: InstalledCommand,
  draft: CommandDraft,
  homeDir: string,
  workspaceRoot?: string
): Promise<InstalledCommand> {
  const currentBase = path.basename(existing.filePath).replace(/\.md$/i, "");
  const newBase = sanitizeCommandName(draft.name);
  const dir = path.dirname(existing.filePath);
  const targetPath = path.join(dir, `${newBase}.md`);
  if (currentBase !== newBase) {
    try {
      await fs.access(targetPath);
      throw new CommandMutationError(
        `Command "${newBase}.md" already exists in this scope.`
      );
    } catch (e) {
      if (e instanceof CommandMutationError) throw e;
    }
  }
  await atomicWriteText(targetPath, renderCommandMarkdown(draft));
  if (
    path.normalize(targetPath).toLowerCase() !==
    path.normalize(existing.filePath).toLowerCase()
  ) {
    try {
      await fs.unlink(existing.filePath);
    } catch {
      /* already gone */
    }
  }
  const all = await listInstalledCommands(homeDir, workspaceRoot);
  const updated = all.find(
    (c) =>
      path.normalize(c.filePath).toLowerCase() ===
      path.normalize(targetPath).toLowerCase()
  );
  if (!updated) {
    throw new CommandMutationError(
      `Command updated but not found back on disk: ${targetPath}`
    );
  }
  return updated;
}

export async function deleteCommand(cmd: InstalledCommand): Promise<void> {
  try {
    await fs.unlink(cmd.filePath);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return;
    throw new CommandMutationError(
      `Could not delete ${cmd.filePath}: ${err?.message ?? String(e)}`
    );
  }
}

/**
 * Parse agent names referenced in a command body.
 * Looks for backtick-quoted names in numbered-list dispatch patterns.
 */
export function parseAgentsFromBody(body: string): string[] {
  const agents: string[] = [];
  const re = /^\s*\d+\.\s*`([^`]+)`/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].trim();
    if (name && !agents.includes(name)) {
      agents.push(name);
    }
  }
  return agents;
}

/**
 * Read the full body of an installed command (everything after frontmatter + marker).
 */
export async function readCommandBody(
  cmd: InstalledCommand
): Promise<string> {
  let text: string;
  try {
    text = await fs.readFile(cmd.filePath, "utf8");
  } catch {
    return "";
  }
  const afterFm = text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
  const afterMarker = afterFm.replace(
    new RegExp(`^\\s*${COMMANDS_PACK_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\r?\\n?`),
    ""
  );
  return afterMarker.trim();
}
