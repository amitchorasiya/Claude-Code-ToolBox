import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteText } from "./agents/atomicFile";

export interface PortMcpResult {
  merged: string[];
  skipped: string[];
  targetPath: string;
}

function readClaudeTarget(targetPath: string): { json: Record<string, unknown>; existing: Record<string, unknown> } {
  let json: Record<string, unknown> = {};
  try {
    const text = fs.readFileSync(targetPath, "utf8");
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // start fresh
  }
  if (!json.mcpServers || typeof json.mcpServers !== "object") {
    json.mcpServers = {};
  }
  return { json, existing: json.mcpServers as Record<string, unknown> };
}

function mergeServersInto(
  sourceServers: Record<string, unknown>,
  existing: Record<string, unknown>,
  merged: string[],
  skipped: string[]
): void {
  const existingLower = new Set(Object.keys(existing).map((k) => k.toLowerCase()));
  for (const [name, cfg] of Object.entries(sourceServers)) {
    if (existingLower.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    const entry = { ...(cfg as Record<string, unknown>) };
    if (!entry.type) {
      if (typeof entry.command === "string") {
        entry.type = "stdio";
      } else if (typeof entry.url === "string") {
        entry.type = "http";
      }
    }
    existing[name] = entry;
    existingLower.add(name.toLowerCase());
    merged.push(name);
  }
}

/**
 * Port MCP servers from Cursor's ~/.cursor/mcp.json into Claude Code config.
 * Merge-only: existing entries in the target are never overwritten.
 */
export async function portMcpToClaudeCode(opts: {
  homeDir?: string;
  cursorMcpPath?: string;
  scope: "user" | "project";
  workspacePath?: string;
}): Promise<PortMcpResult> {
  const homeDir = opts.homeDir ?? os.homedir();
  const cursorMcpPath = opts.cursorMcpPath ?? path.join(homeDir, ".cursor", "mcp.json");

  let cursorText: string;
  try {
    cursorText = fs.readFileSync(cursorMcpPath, "utf8");
  } catch {
    throw new Error(`Cannot read Cursor MCP config at ${cursorMcpPath}`);
  }

  const cursorJson = JSON.parse(cursorText) as Record<string, unknown>;
  const cursorServers = cursorJson?.mcpServers as Record<string, unknown> | undefined;
  if (!cursorServers || typeof cursorServers !== "object") {
    throw new Error("No mcpServers found in Cursor config");
  }

  const targetPath =
    opts.scope === "user"
      ? path.join(homeDir, ".claude.json")
      : path.join(opts.workspacePath!, ".mcp.json");

  const { json: targetJson, existing } = readClaudeTarget(targetPath);
  const merged: string[] = [];
  const skipped: string[] = [];

  mergeServersInto(cursorServers, existing, merged, skipped);

  const content = JSON.stringify(targetJson, null, 2) + "\n";
  await atomicWriteText(targetPath, content);

  return { merged, skipped, targetPath };
}

/**
 * Port MCP servers from VS Code / GitHub Copilot user mcp.json into Claude Code config.
 * VS Code uses the "servers" key (not "mcpServers") and already includes "type".
 * Merge-only: existing entries in the target are never overwritten.
 */
export async function portVsCodeMcpToClaudeCode(opts: {
  homeDir?: string;
  vscodeMcpPath?: string;
  scope: "user" | "project";
  workspacePath?: string;
}): Promise<PortMcpResult> {
  const homeDir = opts.homeDir ?? os.homedir();
  const vscodeMcpPath = opts.vscodeMcpPath ?? vsCodeUserMcpPath(homeDir);

  let text: string;
  try {
    text = fs.readFileSync(vscodeMcpPath, "utf8");
  } catch {
    return { merged: [], skipped: [], targetPath: claudeTargetPath(homeDir, opts.scope, opts.workspacePath) };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { merged: [], skipped: [], targetPath: claudeTargetPath(homeDir, opts.scope, opts.workspacePath) };
  }

  // VS Code uses "servers" key; fall back to "mcpServers" if present
  const sourceServers =
    (parsed.servers && typeof parsed.servers === "object" ? parsed.servers : null) ??
    (parsed.mcpServers && typeof parsed.mcpServers === "object" ? parsed.mcpServers : null);

  if (!sourceServers || typeof sourceServers !== "object") {
    return { merged: [], skipped: [], targetPath: claudeTargetPath(homeDir, opts.scope, opts.workspacePath) };
  }

  const targetPath = claudeTargetPath(homeDir, opts.scope, opts.workspacePath);
  const { json: targetJson, existing } = readClaudeTarget(targetPath);
  const merged: string[] = [];
  const skipped: string[] = [];

  mergeServersInto(sourceServers as Record<string, unknown>, existing, merged, skipped);

  if (merged.length > 0) {
    const content = JSON.stringify(targetJson, null, 2) + "\n";
    await atomicWriteText(targetPath, content);
  }

  return { merged, skipped, targetPath };
}

function claudeTargetPath(homeDir: string, scope: "user" | "project", workspacePath?: string): string {
  return scope === "user"
    ? path.join(homeDir, ".claude.json")
    : path.join(workspacePath!, ".mcp.json");
}

function vsCodeUserMcpPath(homeDir: string): string {
  const plat = process.platform;
  if (plat === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "Code", "User", "mcp.json");
  }
  if (plat === "win32") {
    const appData = process.env.APPDATA ?? path.join(homeDir, "AppData", "Roaming");
    return path.join(appData, "Code", "User", "mcp.json");
  }
  return path.join(homeDir, ".config", "Code", "User", "mcp.json");
}
