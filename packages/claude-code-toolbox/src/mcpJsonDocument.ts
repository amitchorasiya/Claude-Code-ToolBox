import * as path from "node:path";
import * as vscode from "vscode";

export type McpJsonDocument = {
  /** Full JSON object written back (includes `servers`, `inputs`, etc.). */
  raw: Record<string, unknown>;
};

export async function readMcpJsonDocument(uri: vscode.Uri): Promise<McpJsonDocument | undefined> {
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    const raw = JSON.parse(new TextDecoder().decode(buf)) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { raw: { servers: {} } };
    }
    return { raw };
  } catch {
    return undefined;
  }
}

/** Read or return a minimal document suitable for merging servers. */
export async function readOrEmptyMcpJson(uri: vscode.Uri): Promise<McpJsonDocument> {
  const doc = await readMcpJsonDocument(uri);
  if (doc) {
    return doc;
  }
  return { raw: { servers: {} } };
}

function ensureServersObject(raw: Record<string, unknown>): Record<string, unknown> {
  const s = raw.servers;
  if (s && typeof s === "object" && !Array.isArray(s)) {
    return s as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  raw.servers = next;
  return next;
}

export function getServersObject(raw: Record<string, unknown>): Record<string, unknown> {
  return ensureServersObject(raw);
}

export async function writeMcpJsonDocument(uri: vscode.Uri, raw: Record<string, unknown>): Promise<void> {
  const parent = vscode.Uri.file(path.dirname(uri.fsPath));
  try {
    await vscode.workspace.fs.stat(parent);
  } catch {
    await vscode.workspace.fs.createDirectory(parent);
  }
  const text = `${JSON.stringify(raw, null, 2)}\n`;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}
