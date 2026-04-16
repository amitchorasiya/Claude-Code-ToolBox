import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "GitHub PAT-like (ghp_)", re: /ghp_[A-Za-z0-9]{20,}/g },
  { name: "OpenAI sk- key-like", re: /sk-[A-Za-z0-9]{20,}/g },
  { name: "AWS AKIA key id-like", re: /AKIA[0-9A-Z]{16}/g },
];

function maskMatches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  while ((m = r.exec(text)) !== null) {
    const s = m[0];
    out.push(s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : "[redacted]");
  }
  return out;
}

/** Static scan of MCP and instruction files (inspired by security-hardening patterns; not a full SAST). */
export async function runClaudeToolboxConfigScan(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const lines: string[] = [];
  lines.push("# Cloude Code ToolBox — MCP / instruction config scan");
  lines.push("");
  lines.push("_Heuristic scan only. Review findings manually. Not a substitute for secret scanning in CI._");
  lines.push("");

  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;

  const paths: Array<{ label: string; uri: vscode.Uri }> = [
    { label: "Workspace mcp.json", uri: mcpPaths.workspaceMcpUri(folder) },
    {
      label: "User mcp.json",
      uri: vscode.Uri.file(mcpPaths.userMcpJsonPath(insiders)),
    },
    {
      label: "copilot-instructions.md",
      uri: vscode.Uri.joinPath(folder.uri, ".github", "copilot-instructions.md"),
    },
  ];

  for (const { label, uri } of paths) {
    lines.push(`## ${label}`);
    lines.push(`- Path: \`${uri.fsPath}\``);
    try {
      const buf = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(buf);
      lines.push(`- Bytes: ${buf.byteLength}`);
      let foundAny = false;
      for (const { name, re } of SECRET_PATTERNS) {
        const hits = maskMatches(text, re);
        if (hits.length) {
          foundAny = true;
          lines.push(`- **Possible ${name}** (${hits.length} match(es)): ${hits.join(", ")}`);
        }
      }
      if (!foundAny) {
        lines.push("- No common secret-shaped tokens matched (still verify env and commits).");
      }
    } catch {
      lines.push("- _File not found or not readable._");
    }
    lines.push("");
  }

  const ch = vscode.window.createOutputChannel("Cloude Code ToolBox");
  ch.clear();
  ch.appendLine(lines.join("\n"));
  ch.show(true);
  vscode.window.showInformationMessage(
    "Claude Code / MCP config scan complete — see Output: Cloude Code ToolBox."
  );
}
