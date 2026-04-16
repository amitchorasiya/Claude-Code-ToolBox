import { spawn, type ChildProcess } from "node:child_process";

/** Prefer `git.exe` on Windows so spawn does not rely on a `git.cmd` shell shim. */
function gitExecutable(): string {
  return process.platform === "win32" ? "git.exe" : "git";
}

/**
 * Terminate a child process (timeout / overflow). Windows and Unix differ; avoid shell.
 */
function forceKill(child: ChildProcess): void {
  try {
    if (process.platform === "win32") {
      child.kill();
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Run git with fixed argv (no shell). Returns stdout truncated to maxBytes; empty string on failure.
 */
export function runGitCapture(
  cwd: string,
  args: string[],
  maxBytes: number,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(gitExecutable(), args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      forceKill(child);
    }, timeoutMs);

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      let raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length > maxBytes) {
        raw = `${raw.slice(0, maxBytes)}\n[truncated: max ${maxBytes} bytes]`;
      }
      if (timedOut) {
        raw += "\n[truncated: timeout]";
      }
      resolve(raw.trimEnd());
    };

    child.stdout?.on("data", (b: Buffer) => {
      chunks.push(b);
      const total = Buffer.concat(chunks).length;
      if (total > maxBytes) {
        forceKill(child);
      }
    });

    child.stderr?.on("data", () => {
      /* ignore */
    });

    child.on("error", () => finish());
    child.on("close", () => finish());
  });
}

export async function buildGitSection(
  cwd: string,
  maxTotalBytes: number,
  timeoutMs: number
): Promise<string | undefined> {
  const perCmd = Math.floor(maxTotalBytes / 2) - 32;
  const branch = await runGitCapture(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], perCmd, timeoutMs);
  const stat = await runGitCapture(cwd, ["diff", "--stat"], perCmd, timeoutMs);
  if (!branch && !stat) {
    return undefined;
  }
  const lines: string[] = [];
  if (branch) {
    lines.push(`**Branch:** ${branch}`);
  }
  if (stat) {
    lines.push("**Diff --stat:**");
    lines.push("```text");
    lines.push(stat);
    lines.push("```");
  }
  return lines.join("\n");
}
