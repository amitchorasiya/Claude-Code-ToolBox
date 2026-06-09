import * as vscode from "vscode";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as mcpPaths from "../mcpPaths";

export type InitMemoryBankOptions = {
  dryRun: boolean;
  cursorRules?: boolean;
};

/**
 * Resolve the memory bank ESM module path. Tries standard node_modules first
 * (works in dev and VSIX with bundled node_modules), then falls back to
 * the sibling package in the monorepo (dev only).
 */
function resolveMemoryBankPath(): string {
  // Try require.resolve first (works when node_modules is present)
  try {
    return require.resolve("cloude-code-memory-bank/lib/init.mjs");
  } catch { /* not found via standard resolution */ }

  // Fallback: resolve relative to this file's directory (monorepo dev layout)
  const candidates = [
    path.resolve(__dirname, "..", "..", "node_modules", "cloude-code-memory-bank", "lib", "init.mjs"),
    path.resolve(__dirname, "..", "..", "..", "claude-code-memory-bank", "lib", "init.mjs"),
  ];
  for (const candidate of candidates) {
    try {
      require("node:fs").accessSync(candidate);
      return candidate;
    } catch { /* try next */ }
  }

  throw new Error(
    "Cannot find package 'cloude-code-memory-bank'. " +
    "Re-install the extension or run 'npm install' in the extension directory."
  );
}

/**
 * Run memory bank init in-process (no npx).
 * For One Click Setup and manual command.
 */
export async function runInitMemoryBankInProcess(
  folder: vscode.WorkspaceFolder,
  opts: InitMemoryBankOptions
): Promise<void> {
  try {
    const modulePath = resolveMemoryBankPath();
    const moduleUrl = pathToFileURL(modulePath).href;
    // Dynamic import because extension is CJS and memory-bank is ESM
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await (Function(`return import("${moduleUrl}")`)() as Promise<{ initMemoryBank: (opts: { cwd: string; dryRun: boolean; claudeCode: boolean; cursorRules: boolean }) => { created: string[]; skipped: string[]; claudeMdMerged: boolean } }>);
    const { initMemoryBank } = mod;

    const result = initMemoryBank({
      cwd: folder.uri.fsPath,
      dryRun: opts.dryRun,
      claudeCode: true, // This IS a Claude Code extension
      cursorRules: opts.cursorRules ?? false,
    });

    // Show summary
    const summary: string[] = [];
    if (result.created.length > 0) {
      summary.push(`Created ${result.created.length} file(s)`);
    }
    if (result.skipped.length > 0) {
      summary.push(`Skipped ${result.skipped.length} existing file(s)`);
    }
    if (result.claudeMdMerged) {
      summary.push("Merged memory bank section into CLAUDE.md");
    }

    if (opts.dryRun) {
      vscode.window.showInformationMessage(
        `[Dry run] Memory bank preview complete. ${summary.join(", ")}`
      );
    } else {
      vscode.window.showInformationMessage(
        `Memory bank initialized. ${summary.join(", ")}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Memory bank init failed: ${msg}`);
    throw err;
  }
}

export async function initMemoryBank(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const dryPick = await vscode.window.showQuickPick(
    [
      {
        label: "Yes → real run",
        description: "Run init and write files",
        alwaysShow: true,
        value: false as const,
      },
      {
        label: "Yes (dry-run only)",
        description: "Preview only; no files changed",
        alwaysShow: true,
        value: true as const,
      },
    ],
    { title: "Preview only (--dry-run)?", placeHolder: "Choose with ↑↓ or click" }
  );
  if (dryPick === undefined) {
    return;
  }

  const cursorRulesPick = await vscode.window.showQuickPick(
    [
      { label: "No", description: "CLAUDE.md + memory bank only", alwaysShow: true, value: false as const },
      { label: "Yes", description: "Also add .cursor/rules/*.mdc", alwaysShow: true, value: true as const },
    ],
    { title: "Also write Cursor .mdc rules? (--cursor-rules)", placeHolder: "Pick one" }
  );
  if (cursorRulesPick === undefined) {
    return;
  }

  await runInitMemoryBankInProcess(folder, {
    dryRun: dryPick.value,
    cursorRules: cursorRulesPick.value,
  });
}
