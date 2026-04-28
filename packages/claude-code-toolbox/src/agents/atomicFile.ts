/**
 * Shared atomic-write helpers used by agent/team/hook writers.
 *
 * `fs.rename` is atomic on same volume across all major OSes, BUT macOS
 * FSEvents + Spotlight + third-party indexers can transiently pull the temp
 * file out from under us, and two concurrent extension reloads can race.
 * We handle both by falling back to `copyFile` + `unlink` when rename fails.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeThenRename(
  filePath: string,
  content: string | Uint8Array,
  afterWrite?: (tmpPath: string) => Promise<void>
): Promise<void> {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content);
  if (afterWrite) {
    try {
      await afterWrite(tmp);
    } catch {
      /* best-effort */
    }
  }
  try {
    await fs.rename(tmp, filePath);
  } catch (err1) {
    /* Fallback: if the tmp vanished, rewrite it; then copyFile + unlink. */
    try {
      await fs.access(tmp);
    } catch {
      await fs.writeFile(tmp, content);
      if (afterWrite) {
        try {
          await afterWrite(tmp);
        } catch {
          /* best-effort */
        }
      }
    }
    try {
      await fs.copyFile(tmp, filePath);
      try {
        await fs.unlink(tmp);
      } catch {
        /* ignore */
      }
    } catch (err2) {
      try {
        await fs.unlink(tmp);
      } catch {
        /* ignore */
      }
      throw err2;
    }
  }
}

export async function atomicWriteText(
  filePath: string,
  content: string,
  mode?: number
): Promise<void> {
  await ensureDir(filePath);
  await writeThenRename(filePath, content, async (tmp) => {
    if (mode !== undefined && process.platform !== "win32") {
      await fs.chmod(tmp, mode);
    }
  });
  if (mode !== undefined && process.platform !== "win32") {
    try {
      await fs.chmod(filePath, mode);
    } catch {
      /* best-effort */
    }
  }
}
