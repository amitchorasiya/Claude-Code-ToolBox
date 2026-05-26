/**
 * Cross-platform resolver for the `claude` CLI binary.
 *
 * Order of precedence:
 *   1. Explicit override from `cloude-code-toolbox.agentTeams.claudeBinOverride`.
 *   2. `claude.cmd` / `claude.exe` on Windows (via PATH probing) — `shell: false`
 *      spawning fails on `.cmd` shims unless we resolve to an explicit path.
 *   3. `claude` on POSIX.
 *
 * Returns `undefined` when the CLI cannot be found. Callers surface a toast.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export type ClaudeCliStatus = {
  ok: boolean;
  binPath?: string;
  /** Human-readable reason when `ok` is false — safe to show in a toast. */
  reason?: string;
};

function isWindows(): boolean {
  return process.platform === "win32";
}

async function isExecutableFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function which(cmd: string): Promise<string[]> {
  const found: string[] = [];
  const pathEnv = process.env.PATH ?? "";
  const sep = isWindows() ? ";" : ":";
  const exts = isWindows()
    ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((s) => s.trim()).filter(Boolean)
    : [""];
  for (const dir of pathEnv.split(sep)) {
    const base = dir.trim();
    if (!base) {
      continue;
    }
    for (const ext of exts) {
      const candidate = path.join(base, `${cmd}${ext}`);
      if (await isExecutableFile(candidate)) {
        found.push(candidate);
      }
    }
  }
  return found;
}

async function probeExternalWhich(cmd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const finder = isWindows() ? "where" : "which";
    const child = spawn(finder, [cmd], { shell: false, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve(undefined));
    child.on("close", () => {
      const first = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      resolve(first || undefined);
    });
  });
}

function commonInstallPaths(): string[] {
  if (isWindows()) {
    const appData = process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local");
    return [
      path.join(appData, "Claude", "claude.exe"),
      path.join(localAppData, "Programs", "claude", "claude.exe"),
      path.join(localAppData, "Microsoft", "WinGet", "Links", "claude.exe"),
      path.join(process.env.USERPROFILE ?? "", ".claude", "bin", "claude.exe"),
      path.join(process.env.USERPROFILE ?? "", "scoop", "shims", "claude.exe"),
    ];
  }
  const home = process.env.HOME ?? "";
  return [
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(home, ".local/bin/claude"),
    path.join(home, ".claude/bin/claude"),
  ];
}

const COMMON_INSTALL_PATHS = commonInstallPaths();

/** Resolve the `claude` binary path; returns `undefined` when not found. */
export async function resolveClaudeBin(override?: string): Promise<string | undefined> {
  if (override && override.trim()) {
    const p = override.trim();
    if (await isExecutableFile(p)) {
      return p;
    }
  }
  const matches = await which("claude");
  if (isWindows()) {
    const preferred = matches.find((p) => /\.cmd$/i.test(p)) ?? matches.find((p) => /\.exe$/i.test(p));
    if (preferred) {
      return preferred;
    }
  } else if (matches.length > 0) {
    return matches[0];
  }
  const external = await probeExternalWhich("claude");
  if (external) {
    return external;
  }
  for (const candidate of COMMON_INSTALL_PATHS) {
    if (await isExecutableFile(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function checkClaudeCli(override?: string): Promise<ClaudeCliStatus> {
  const binPath = await resolveClaudeBin(override);
  if (!binPath) {
    return {
      ok: false,
      reason:
        "`claude` CLI was not found on PATH. Install Claude Code (https://docs.claude.com/claude-code) or set `cloude-code-toolbox.agentTeams.claudeBinOverride`.",
    };
  }
  return { ok: true, binPath };
}

const MIN_AGENT_TEAMS_VERSION = "2.1.32";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) {
      return na - nb;
    }
  }
  return 0;
}

export async function getClaudeVersion(binPath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(binPath, ["--version"], { shell: false, windowsHide: true, timeout: 5000 });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve(undefined));
    child.on("close", () => {
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      resolve(match?.[1]);
    });
  });
}

export async function isNativeTeamsAvailable(override?: string): Promise<boolean> {
  const binPath = await resolveClaudeBin(override);
  if (!binPath) {
    return false;
  }
  const version = await getClaudeVersion(binPath);
  if (!version) {
    return false;
  }
  return compareVersions(version, MIN_AGENT_TEAMS_VERSION) >= 0;
}
