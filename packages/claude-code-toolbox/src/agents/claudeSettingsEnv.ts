/**
 * Read/write the `env` block inside `~/.claude/settings.json`.
 *
 * Used by the Agent Teams toggle to inject or remove
 * CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 so that ALL Claude Code sessions
 * (including those launched by the VS Code extension) inherit the flag.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteText } from "./atomicFile";

function settingsPath(homeDir?: string): string {
  return path.join(homeDir ?? os.homedir(), ".claude", "settings.json");
}

type UnknownRecord = Record<string, unknown>;

function readSettings(filePath: string): UnknownRecord {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return {};
    throw new Error(`Cannot read ${filePath}: ${err.message ?? String(e)}`);
  }
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} is not a JSON object`);
  }
  return parsed as UnknownRecord;
}

async function atomicWriteJson(filePath: string, obj: UnknownRecord): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteText(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

export async function setClaudeEnvVar(
  key: string,
  value: string | undefined,
  homeDir?: string
): Promise<void> {
  const p = settingsPath(homeDir);
  const settings = readSettings(p);
  const env: UnknownRecord =
    settings.env && typeof settings.env === "object" && !Array.isArray(settings.env)
      ? { ...(settings.env as UnknownRecord) }
      : {};

  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }

  const next: UnknownRecord = { ...settings };
  if (Object.keys(env).length) {
    next.env = env;
  } else {
    delete next.env;
  }

  await atomicWriteJson(p, next);
}

export async function getClaudeEnvVar(
  key: string,
  homeDir?: string
): Promise<string | undefined> {
  const p = settingsPath(homeDir);
  try {
    const settings = readSettings(p);
    if (settings.env && typeof settings.env === "object" && !Array.isArray(settings.env)) {
      const val = (settings.env as UnknownRecord)[key];
      return typeof val === "string" ? val : undefined;
    }
  } catch {
    /* file missing or malformed — treat as unset */
  }
  return undefined;
}

export async function syncAgentTeamsEnvVar(enabled: boolean, homeDir?: string): Promise<void> {
  await setClaudeEnvVar(
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
    enabled ? "1" : undefined,
    homeDir
  );
}
