/**
 * Scan `~/.claude/projects/` and surface per-session transcript files.
 *
 * We don't try to reproduce Claude's cwd-to-folder encoding rule — we just
 * iterate every sub-directory and list its `.jsonl` files; if a file exists
 * we consider the session known and read the first line to learn its cwd.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

export type ProjectSessionFile = {
  sessionId: string;
  filePath: string;
  projectFolder: string;
  mtime: number;
  size: number;
};

export function projectsRoot(homeDir: string): string {
  return path.join(homeDir, ".claude", "projects");
}

export async function scanProjectsForSessions(homeDir: string): Promise<ProjectSessionFile[]> {
  const root = projectsRoot(homeDir);
  const out: ProjectSessionFile[] = [];
  let folders: import("node:fs").Dirent[];
  try {
    folders = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const abs = path.join(root, folder.name);
    let files: import("node:fs").Dirent[];
    try {
      files = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.isFile()) continue;
      if (!/\.jsonl$/i.test(f.name)) continue;
      const filePath = path.join(abs, f.name);
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue;
      }
      out.push({
        sessionId: f.name.replace(/\.jsonl$/i, ""),
        filePath,
        projectFolder: folder.name,
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

/** Sessions touched within the last `maxAgeMs` ms. */
export async function findRecentlyActiveSessions(
  homeDir: string,
  maxAgeMs = 1000 * 60 * 60 * 24 * 2
): Promise<ProjectSessionFile[]> {
  const all = await scanProjectsForSessions(homeDir);
  const now = Date.now();
  return all.filter((s) => now - s.mtime <= maxAgeMs);
}
