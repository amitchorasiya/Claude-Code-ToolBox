#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { convertCursorMcpToVsCode } from "../lib/convert.mjs";

function defaultCursorMcpPath() {
  return join(homedir(), ".cursor", "mcp.json");
}

function defaultVsCodeUserMcpPath(flavor = "stable") {
  const home = homedir();
  const dir = flavor === "insiders" ? "Code - Insiders" : "Code";
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", dir, "User", "mcp.json");
  }
  if (platform() === "win32") {
    const appData = process.env.APPDATA;
    if (appData) return join(appData, dir, "User", "mcp.json");
  }
  const configDir = flavor === "insiders" ? "Code - Insiders" : "Code";
  return join(home, ".config", configDir, "User", "mcp.json");
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function mergeVsCodeMcp(existing, incoming) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const servers = { ...(base.servers || {}) };
  for (const [k, v] of Object.entries(incoming.servers || {})) {
    servers[k] = v;
  }
  const out = { ...base, servers };
  const inputsIn = incoming.inputs;
  const inputsEx = base.inputs;
  if (Array.isArray(inputsIn) && inputsIn.length) {
    const merged = [...(Array.isArray(inputsEx) ? inputsEx : []), ...inputsIn];
    const seen = new Set();
    out.inputs = merged.filter((item) => {
      const id = item && item.id;
      if (id == null) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else if (Array.isArray(inputsEx)) {
    out.inputs = inputsEx;
  }
  return out;
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", short: "s" },
      out: { type: "string", short: "o" },
      target: { type: "string", short: "t" },
      merge: { type: "boolean", default: false },
      /** @deprecated No-op: merge is always used when the output file exists. */
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      "no-sanitize-names": { type: "boolean", default: false },
      "no-fix-snyk": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`cursor-mcp-to-github-copilot-port — Cursor mcpServers → VS Code mcp.json (GitHub Copilot MCP)

Usage:
  npx cursor-mcp-to-github-copilot-port [options]

Options:
  -s, --source <path>   Cursor mcp.json (default: ~/.cursor/mcp.json)
  -t, --target <where>  workspace | user | insiders | stdout (default: workspace)
  -o, --out <path>      Output file path (overrides --target default path)
      --merge           (Optional) Ignored for compatibility — existing mcp.json is always merged with converted servers.
      --force           Deprecated no-op (merge-only behavior; never replaces the whole file)
      --dry-run           Print JSON to stdout only; do not write files
      --no-sanitize-names Keep original server keys (VS Code prefers camelCase)
      --no-fix-snyk       Do not rewrite IDE_CONFIG_PATH Cursor → VSCode for Snyk
  -h, --help            Show help

Examples:
  npx cursor-mcp-to-github-copilot-port
  npx cursor-mcp-to-github-copilot-port -t user --merge
  npx cursor-mcp-to-github-copilot-port -s ~/.cursor/mcp.json -o ./.vscode/mcp.json
`);
    process.exit(0);
  }

  const sourcePath = resolve(values.source || defaultCursorMcpPath());
  if (!(await fileExists(sourcePath))) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(1);
  }

  const cursorJson = await readJson(sourcePath);
  if (values.force) {
    console.error(
      '[cursor-mcp-vscode-port] "--force" is deprecated and ignored; merge-only behavior is always enforced.'
    );
  }
  const { mcp: converted, nameMap } = convertCursorMcpToVsCode(cursorJson, {
    sanitizeNames: !values["no-sanitize-names"],
    fixSnykIde: !values["no-fix-snyk"],
  });

  let outputPath;
  if (values.out) {
    outputPath = resolve(values.out);
  } else {
    const target = values.target || "workspace";
    if (target === "stdout") {
      outputPath = null;
    } else if (target === "user") {
      outputPath = defaultVsCodeUserMcpPath("stable");
    } else if (target === "insiders") {
      outputPath = defaultVsCodeUserMcpPath("insiders");
    } else if (target === "workspace") {
      outputPath = resolve(process.cwd(), ".vscode", "mcp.json");
    } else {
      console.error('Invalid --target: use workspace | user | insiders | stdout');
      process.exit(1);
    }
  }

  let finalDoc = converted;
  if (outputPath && (await fileExists(outputPath))) {
    const existing = await readJson(outputPath);
    finalDoc = mergeVsCodeMcp(existing, converted);
  }

  const printOnly =
    values["dry-run"] ||
    (!values.out && (values.target || "workspace") === "stdout");

  if (printOnly) {
    console.log(JSON.stringify(finalDoc, null, 2));
    if (nameMap.length) {
      console.error("\n# Server name mapping (Cursor → VS Code id):");
      for (const { cursor, vscode } of nameMap) {
        console.error(`  ${cursor} → ${vscode}`);
      }
    }
    process.exit(0);
  }

  if (!outputPath) {
    console.error("Internal error: no output path");
    process.exit(1);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(finalDoc, null, 2)}\n`, "utf8");

  console.error(`Wrote ${outputPath}`);
  if (nameMap.length) {
    console.error("Server ids:");
    for (const { cursor, vscode } of nameMap) {
      console.error(`  ${cursor} → ${vscode}`);
    }
  }
  console.error("\nIn VS Code: open Copilot Chat → Agent mode → tools icon to use MCP.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
