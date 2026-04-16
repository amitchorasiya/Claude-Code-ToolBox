/**
 * Discover SKILL.md skill folders on disk for the MCP & skills hub.
 *
 * These paths are common conventions for project vs personal skills. Listing them here
 * does **not** register anything with GitHub Copilot — Copilot does not automatically load
 * arbitrary SKILL.md from these folders; this is editor-side navigation only.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Personal skill roots under the user home directory (each contains subfolders with SKILL.md). */
export const USER_SKILL_ROOT_SEGMENTS = [
  [".copilot", "skills"],
  [".claude", "skills"],
  [".agents", "skills"],
  [".cursor", "skills"],
] as const;

/** Project skill roots relative to the workspace folder root. */
export const WORKSPACE_SKILL_ROOT_SEGMENTS = [
  [".github", "skills"],
  [".claude", "skills"],
  [".agents", "skills"],
  [".cursor", "skills"],
] as const;

export type SkillEntry = {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  /** Absolute path to SKILL.md (OS-correct separators) */
  skillMdPath: string;
  scope: "user" | "workspace";
  /** Hub-only: marked off in extension state (folder still on disk). */
  disabled?: boolean;
};

async function readSkillDescription(skillRoot: string): Promise<string> {
  const p = path.join(skillRoot, "SKILL.md");
  try {
    const text = await fs.readFile(p, "utf8");
    const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fm) {
      const m = fm[1].match(/description:\s*(.+)/i);
      if (m) {
        return m[1].trim().replace(/^["']|["']$/g, "").slice(0, 220);
      }
    }
    const body = text.replace(/^---[\s\S]*?---\s*/, "").trim();
    const line = body.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
    return (line ?? "Skill (SKILL.md)").trim().slice(0, 220);
  } catch {
    return "";
  }
}

async function scanSkillsUnderRoot(
  root: string,
  scope: "user" | "workspace"
): Promise<SkillEntry[]> {
  const out: SkillEntry[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) {
        continue;
      }
      const skillRoot = path.join(root, e.name);
      try {
        await fs.access(path.join(skillRoot, "SKILL.md"));
      } catch {
        continue;
      }
      const description = (await readSkillDescription(skillRoot)) || "Skill (SKILL.md)";
      out.push({
        id: `${scope}:${path.normalize(skillRoot)}`,
        name: e.name,
        description,
        rootPath: skillRoot,
        skillMdPath: path.join(skillRoot, "SKILL.md"),
        scope,
      });
    }
  } catch {
    /* missing or unreadable dir */
  }
  return out;
}

function joinSegments(base: string, segments: readonly string[]): string {
  return path.join(base, ...segments);
}

/**
 * Collect skill entries from all configured user and (optional) workspace roots.
 * Order: workspace roots first (github → claude → agents → cursor), then user roots (same order).
 */
export async function collectLocalSkills(
  homeDir: string,
  workspaceRoot?: string
): Promise<SkillEntry[]> {
  const seen = new Set<string>();
  const merged: SkillEntry[] = [];

  const pushAll = async (roots: readonly (readonly string[])[], base: string, scope: "user" | "workspace") => {
    for (const segments of roots) {
      const root = joinSegments(base, segments);
      const found = await scanSkillsUnderRoot(root, scope);
      for (const s of found) {
        const key = path.normalize(s.skillMdPath).toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(s);
      }
    }
  };

  if (workspaceRoot) {
    await pushAll(WORKSPACE_SKILL_ROOT_SEGMENTS, workspaceRoot, "workspace");
  }
  await pushAll(USER_SKILL_ROOT_SEGMENTS, homeDir, "user");

  return merged;
}
