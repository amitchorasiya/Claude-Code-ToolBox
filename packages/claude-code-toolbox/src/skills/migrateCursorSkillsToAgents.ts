import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const CURSOR_SKILLS_SEGMENTS = [".cursor", "skills"] as const;
export const GITHUB_SKILLS_SEGMENTS = [".github", "skills"] as const;
export const COPILOT_USER_SKILLS_SEGMENTS = [".copilot", "skills"] as const;
export const AGENTS_SKILLS_SEGMENTS = [".agents", "skills"] as const;

export function cursorSkillsDir(base: string): string {
  return path.join(base, ...CURSOR_SKILLS_SEGMENTS);
}

export function githubSkillsDir(base: string): string {
  return path.join(base, ...GITHUB_SKILLS_SEGMENTS);
}

export function copilotUserSkillsDir(base: string): string {
  return path.join(base, ...COPILOT_USER_SKILLS_SEGMENTS);
}

export function agentsSkillsDir(base: string): string {
  return path.join(base, ...AGENTS_SKILLS_SEGMENTS);
}

/** Subfolders of `skillsRootDir` that contain SKILL.md. */
export async function listSkillFoldersAtRoot(skillsRootDir: string): Promise<{ name: string; abs: string }[]> {
  const out: { name: string; abs: string }[] = [];
  try {
    const entries = await fs.readdir(skillsRootDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) {
        continue;
      }
      const abs = path.join(skillsRootDir, e.name);
      try {
        await fs.access(path.join(abs, "SKILL.md"));
      } catch {
        continue;
      }
      out.push({ name: e.name, abs });
    }
  } catch {
    /* missing or unreadable */
  }
  return out;
}

/** @deprecated Use listSkillFoldersAtRoot(cursorSkillsRoot) */
export async function listCursorSkillFolders(cursorSkillsRoot: string): Promise<{ name: string; abs: string }[]> {
  return listSkillFoldersAtRoot(cursorSkillsRoot);
}

export type MigrateSkillMode = "copy" | "move";

export type MigrateOneResult = "migrated" | "skipped" | "error";

/**
 * Copy files from `srcDir` into `destDir` only where the destination path is missing (add-only merge).
 * @returns relative paths (posix) of files that were created under dest.
 */
async function mergeSkillFolderAddOnly(
  srcDir: string,
  destDir: string
): Promise<{ added: number; copiedRelPaths: string[] }> {
  let added = 0;
  const copiedRelPaths: string[] = [];
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const sp = path.join(srcDir, e.name);
    const dp = path.join(destDir, e.name);
    if (e.isDirectory()) {
      const sub = await mergeSkillFolderAddOnly(sp, dp);
      added += sub.added;
      for (const r of sub.copiedRelPaths) {
        copiedRelPaths.push(path.join(e.name, r).split(path.sep).join("/"));
      }
    } else {
      try {
        await fs.access(dp);
      } catch {
        await fs.mkdir(path.dirname(dp), { recursive: true });
        await fs.copyFile(sp, dp);
        added++;
        copiedRelPaths.push(e.name);
      }
    }
  }
  return { added, copiedRelPaths };
}

async function unlinkRelPathsUnder(root: string, relPaths: string[]): Promise<void> {
  for (const rel of relPaths) {
    const p = path.join(root, ...rel.split("/"));
    try {
      await fs.unlink(p);
    } catch {
      /* */
    }
  }
}

/** Best-effort remove empty directories under `root` (bottom-up). */
async function pruneEmptyDirsUnder(root: string): Promise<void> {
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name));
      }
    }
    try {
      const left = await fs.readdir(dir);
      if (left.length === 0 && dir !== root) {
        await fs.rmdir(dir);
      }
    } catch {
      /* */
    }
  }
  await walk(root);
}

/**
 * Copy or move one skill folder into `.agents/skills/<name>`.
 * If the destination already exists, **add-only** merge: copy missing files; never overwrite.
 * Move mode removes from source only files that were merged (copied) into dest.
 */
export async function migrateOneSkillFolder(
  srcFolderAbs: string,
  agentsSkillsParent: string,
  name: string,
  mode: MigrateSkillMode
): Promise<MigrateOneResult> {
  const dest = path.join(agentsSkillsParent, name);
  let destExists = false;
  try {
    await fs.access(dest);
    destExists = true;
  } catch {
    /* dest missing */
  }

  if (!destExists) {
    try {
      await fs.mkdir(agentsSkillsParent, { recursive: true });
      await fs.cp(srcFolderAbs, dest, { recursive: true });
      if (mode === "move") {
        await fs.rm(srcFolderAbs, { recursive: true, force: true });
      }
      return "migrated";
    } catch {
      return "error";
    }
  }

  try {
    const { added, copiedRelPaths } = await mergeSkillFolderAddOnly(srcFolderAbs, dest);
    if (added === 0) {
      return "skipped";
    }
    if (mode === "move") {
      await unlinkRelPathsUnder(srcFolderAbs, copiedRelPaths);
      await pruneEmptyDirsUnder(srcFolderAbs);
    }
    return "migrated";
  } catch {
    return "error";
  }
}

export type ScopeRun = {
  /** Source skills directory scanned (e.g. …/.cursor/skills or …/.github/skills). */
  skillsSourcePath: string;
  found: number;
  migrated: number;
  skipped: number;
  errors: number;
};

export async function runSkillsMigrationFromRoot(
  baseDir: string,
  sourceSegments: readonly string[],
  mode: MigrateSkillMode
): Promise<ScopeRun> {
  const skillsSourcePath = path.join(baseDir, ...sourceSegments);
  const agentsRoot = agentsSkillsDir(baseDir);
  const folders = await listSkillFoldersAtRoot(skillsSourcePath);
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  for (const f of folders) {
    const r = await migrateOneSkillFolder(f.abs, agentsRoot, f.name, mode);
    if (r === "migrated") {
      migrated++;
    } else if (r === "skipped") {
      skipped++;
    } else {
      errors++;
    }
  }
  return {
    skillsSourcePath,
    found: folders.length,
    migrated,
    skipped,
    errors,
  };
}

export async function runMigrationForRoot(baseDir: string, mode: MigrateSkillMode): Promise<ScopeRun> {
  return runSkillsMigrationFromRoot(baseDir, CURSOR_SKILLS_SEGMENTS, mode);
}

export async function runCopilotGithubSkillsMigrationForRoot(
  baseDir: string,
  mode: MigrateSkillMode
): Promise<ScopeRun> {
  return runSkillsMigrationFromRoot(baseDir, GITHUB_SKILLS_SEGMENTS, mode);
}

export async function runCopilotUserSkillsMigrationForRoot(
  baseDir: string,
  mode: MigrateSkillMode
): Promise<ScopeRun> {
  return runSkillsMigrationFromRoot(baseDir, COPILOT_USER_SKILLS_SEGMENTS, mode);
}
