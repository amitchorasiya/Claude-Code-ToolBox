import * as vscode from "vscode";

export type ServerSummary = { id: string; kind: string; detail: string };

export function summarizeServer(id: string, cfg: unknown): ServerSummary {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { id, kind: "?", detail: "invalid entry" };
  }
  const o = cfg as Record<string, unknown>;
  const t = typeof o.type === "string" ? o.type : "";
  if (o.command && typeof o.command === "string") {
    const cmd = o.command as string;
    const args = Array.isArray(o.args) ? (o.args as string[]).join(" ") : "";
    return {
      id,
      kind: t || "stdio",
      detail: args ? `${cmd} ${args}` : cmd,
    };
  }
  if (o.url && typeof o.url === "string") {
    return { id, kind: t || "http", detail: o.url as string };
  }
  return { id, kind: t || "?", detail: JSON.stringify(cfg).slice(0, 80) };
}

export async function parseMcpServers(
  uri: vscode.Uri
): Promise<ServerSummary[] | undefined> {
  try {
    const doc = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(doc);
    const json = JSON.parse(text) as { servers?: Record<string, unknown> };
    if (!json.servers || typeof json.servers !== "object") {
      return [];
    }
    return Object.entries(json.servers).map(([id, cfg]) => summarizeServer(id, cfg));
  } catch {
    return undefined;
  }
}
