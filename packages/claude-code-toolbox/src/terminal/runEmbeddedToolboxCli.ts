import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "amitchorasiya.cloude-code-toolbox";

const TERM_NAME = "Cloude Code ToolBox";

function quoteArg(arg: string): string {
  if (process.platform === "win32") {
    if (!/[\s"]/.test(arg)) {
      return arg;
    }
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  if (!/[\s'$]/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function resolveToolboxPackageBinFromExtensionPath(
  packageName: string,
  binSubpath: string
): string | undefined {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    return undefined;
  }
  const pkgJson = path.join(ext.extensionPath, "node_modules", packageName, "package.json");
  if (!fs.existsSync(pkgJson)) {
    return undefined;
  }
  return path.join(path.dirname(pkgJson), ...binSubpath.split("/"));
}

/**
 * Absolute path to a file inside an npm dependency (resolved from this extension's node_modules).
 */
export function resolveToolboxPackageBin(packageName: string, binSubpath: string): string {
  const binParts = binSubpath.split("/");
  try {
    const req = createRequire(__filename);
    const pkgJson = req.resolve(`${packageName}/package.json`);
    const cli = path.join(path.dirname(pkgJson), ...binParts);
    if (fs.existsSync(cli)) {
      return cli;
    }
  } catch {
    /* try extensionPath */
  }
  const fromExt = resolveToolboxPackageBinFromExtensionPath(packageName, binSubpath);
  if (fromExt && fs.existsSync(fromExt)) {
    return fromExt;
  }
  throw new Error(`Could not resolve ${packageName} under the extension`);
}

export function tryResolveToolboxPackageBin(
  packageName: string,
  binSubpath: string
): string | undefined {
  try {
    return resolveToolboxPackageBin(packageName, binSubpath);
  } catch {
    return undefined;
  }
}

/**
 * In the extension host, `process.execPath` is VS Code’s **Code Helper (Plugin)** (Electron), not Node.js.
 * Bundled `.mjs` / `.js` CLIs must be run with a real **node** binary (PATH or setting).
 */
function nodeCommandPrefixForTerminal(): string {
  const cfg = vscode.workspace.getConfiguration();
  const custom = cfg.get<string>("cloude-code-toolbox.embeddedBridgeNodeExecutable")?.trim() ?? "";
  if (custom.length > 0) {
    return quoteArg(custom);
  }
  return "node";
}

/**
 * Runs a Node CLI entry file via the user’s `node` on PATH (or `cloude-code-toolbox.embeddedBridgeNodeExecutable`).
 * Does not use npx or network fetches; scripts still ship inside the extension.
 */
export function runNodeCliInTerminal(
  cwd: string,
  cliAbsolutePath: string,
  args: string[],
  displayName: string
): void {
  const term =
    vscode.window.terminals.find((t) => t.name === TERM_NAME) ??
    vscode.window.createTerminal({ name: TERM_NAME, cwd });
  term.show();
  const node = nodeCommandPrefixForTerminal();
  const script = quoteArg(cliAbsolutePath);
  const rest = args.map(quoteArg).join(" ");
  const line = rest.length > 0 ? `${node} ${script} ${rest}` : `${node} ${script}`;
  term.sendText(line, true);
  vscode.window.showInformationMessage(`Running in terminal: ${displayName}`);
}

export const TOOLBOX_BRIDGE_BINS = {
  mcpPort: { packageName: "cursor-mcp-vscode-port", bin: "bin/cli.mjs" },
  rulesConverter: { packageName: "cursor-rules-to-claude", bin: "bin/cli.js" },
  memoryBank: { packageName: "cloude-code-memory-bank", bin: "bin/cli.mjs" },
} as const;
