import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";
import type { InitMemoryBankNpxOptions } from "./memoryBankInit";
import type { PortCursorMcpMode } from "./portFromCursor";
import {
  agentsSkillsDir,
  copilotUserSkillsDir,
  cursorSkillsDir,
  githubSkillsDir,
} from "../skills/migrateCursorSkillsToAgents";
import {
  runNodeCliInTerminal,
  TOOLBOX_BRIDGE_BINS,
  tryResolveToolboxPackageBin,
} from "../terminal/runEmbeddedToolboxCli";

function missingBundledCliMessage(packageName: string): void {
  vscode.window.showErrorMessage(
    `Bundled tool "${packageName}" was not found (node_modules). Reinstall the extension, or from the repo run npm install in packages/cloude-code-toolbox.`
  );
}

/**
 * Same behavior as npx cursor-mcp-vscode-port, using the CLI shipped with the extension.
 */
export async function manualPortCursorMcpWithoutNpx(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.mcpPort;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    missingBundledCliMessage(packageName);
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      { label: "User mcp.json (merge with existing)", value: "user" as const },
      { label: "Workspace .vscode/mcp.json (merge with existing)", value: "workspace" as const },
      { label: "Dry run (print JSON only)", value: "dry" as const },
    ],
    { title: "Port Cursor MCP → VS Code (bundled CLI)" }
  );
  if (!mode) {
    return;
  }

  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;

  const args: string[] = [];
  const m: PortCursorMcpMode = mode.value;
  if (m === "dry") {
    args.push("--dry-run");
  } else if (m === "user") {
    args.push("-t", insiders ? "insiders" : "user");
  }

  runNodeCliInTerminal(folder.uri.fsPath, cli, args, "Cursor MCP port (bundled)");
}

/**
 * Same behavior as npx cloude-code-memory-bank init, using the CLI shipped with the extension.
 */
export async function memoryBankWithoutNpx(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.memoryBank;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    missingBundledCliMessage(packageName);
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
        description: "Preview in terminal; no files changed",
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

  const flags: string[] = ["init", "--cwd", folder.uri.fsPath];
  if (dryPick.value) {
    flags.push("--dry-run");
  }
  if (cursorRulesPick.value) {
    flags.push("--cursor-rules");
  }

  runNodeCliInTerminal(folder.uri.fsPath, cli, flags, "Memory bank (bundled)");
}

/**
 * Same behavior as npx cursor-rules-to-claude, using the CLI shipped with the extension.
 */
export async function cursorRulesToClaudeWithoutNpx(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.rulesConverter;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    missingBundledCliMessage(packageName);
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      { label: "Run (write CLAUDE.md + .claude/rules)", value: "run" as const },
      { label: "Dry run (preview only)", value: "dry" as const },
    ],
    { title: "Sync Cursor rules → CLAUDE.md (bundled CLI)" }
  );
  if (!pick) {
    return;
  }

  const args = ["--cwd", folder.uri.fsPath];
  if (pick.value === "dry") {
    args.push("--dry-run");
  }

  runNodeCliInTerminal(folder.uri.fsPath, cli, args, "Cursor rules → CLAUDE.md (bundled)");
}

async function mkdirRevealSkillsRoot(base: string): Promise<void> {
  const c = cursorSkillsDir(base);
  const a = agentsSkillsDir(base);
  await fs.mkdir(c, { recursive: true });
  await fs.mkdir(a, { recursive: true });
  await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(c));
  await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(a));
}

/**
 * Reveal .cursor/skills and .agents/skills (migration is already extension-side; no npx).
 */
export async function revealSkillFoldersWithoutNpx(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  const home = os.homedir();

  type Scope = "workspace" | "user" | "both";
  const items: { label: string; description: string; value: Scope }[] = [];
  if (folder) {
    items.push({
      label: "Workspace only",
      description: ".cursor/skills and .agents/skills in the open folder",
      value: "workspace",
    });
  }
  items.push({
    label: "User only",
    description: "~/.cursor/skills and ~/.agents/skills",
    value: "user",
  });
  if (folder) {
    items.push({
      label: "Workspace + user",
      description: "Both locations",
      value: "both",
    });
  }

  const pick = await vscode.window.showQuickPick(items, {
    title: "Reveal skill folders (no npx — use Run migration or copy manually)",
  });
  if (!pick) {
    return;
  }

  try {
    if (pick.value === "workspace" || pick.value === "both") {
      if (!folder) {
        vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }
      await mkdirRevealSkillsRoot(folder.uri.fsPath);
    }
    if (pick.value === "user" || pick.value === "both") {
      await mkdirRevealSkillsRoot(home);
    }
  } catch {
    vscode.window.showErrorMessage("Could not create or reveal skill folders.");
    return;
  }

  vscode.window.showInformationMessage(
    "Skill migration does not use npx. Use Run migration on the hub or copy SKILL.md folders between these roots."
  );
}

/**
 * Reveal `.github/skills`, `~/.copilot/skills`, and `.agents/skills` for Copilot → Claude migration.
 */
export async function revealCopilotSkillFoldersWithoutNpx(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  const home = os.homedir();

  type Scope = "workspace" | "user" | "both";
  const items: { label: string; description: string; value: Scope }[] = [];
  if (folder) {
    items.push({
      label: "Workspace only",
      description: ".github/skills and .agents/skills in the open folder",
      value: "workspace",
    });
  }
  items.push({
    label: "User only",
    description: "~/.copilot/skills and ~/.agents/skills",
    value: "user",
  });
  if (folder) {
    items.push({
      label: "Workspace + user",
      description: "Both locations",
      value: "both",
    });
  }

  const pick = await vscode.window.showQuickPick(items, {
    title: "Reveal Copilot/GitHub skill folders",
  });
  if (!pick) {
    return;
  }

  try {
    if (pick.value === "workspace" || pick.value === "both") {
      if (!folder) {
        vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }
      const gh = githubSkillsDir(folder.uri.fsPath);
      const ag = agentsSkillsDir(folder.uri.fsPath);
      await fs.mkdir(gh, { recursive: true });
      await fs.mkdir(ag, { recursive: true });
      await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(gh));
      await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(ag));
    }
    if (pick.value === "user" || pick.value === "both") {
      const cop = copilotUserSkillsDir(home);
      const ag = agentsSkillsDir(home);
      await fs.mkdir(cop, { recursive: true });
      await fs.mkdir(ag, { recursive: true });
      await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(cop));
      await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(ag));
    }
  } catch {
    vscode.window.showErrorMessage("Could not create or reveal Copilot skill folders.");
    return;
  }

  vscode.window.showInformationMessage(
    "Use Run migration on the hub to copy SKILL.md folders into .agents/skills."
  );
}

export type BundledBridgeQuiet = { quietMissing?: boolean };

/**
 * Same argv as {@link runInitMemoryBankWithOptions} / npx, using the extension-bundled CLI (no npx, no network).
 * @returns false if the CLI path could not be resolved.
 */
export function runInitMemoryBankBundledWithOptions(
  folder: vscode.WorkspaceFolder,
  opts: InitMemoryBankNpxOptions,
  quiet?: BundledBridgeQuiet
): boolean {
  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.memoryBank;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    if (!quiet?.quietMissing) {
      missingBundledCliMessage(packageName);
    }
    return false;
  }
  const flags: string[] = ["init", "--cwd", folder.uri.fsPath];
  if (opts.dryRun) {
    flags.push("--dry-run");
  }
  if (opts.cursorRules) {
    flags.push("--cursor-rules");
  }
  runNodeCliInTerminal(folder.uri.fsPath, cli, flags, "Memory bank (bundled)");
  return true;
}

/** Same argv as {@link runSyncCursorRulesWithOptions} / npx; bundled CLI only. */
export function runSyncCursorRulesBundledWithOptions(
  folder: vscode.WorkspaceFolder,
  dryRun: boolean,
  quiet?: BundledBridgeQuiet
): boolean {
  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.rulesConverter;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    if (!quiet?.quietMissing) {
      missingBundledCliMessage(packageName);
    }
    return false;
  }
  const args = ["--cwd", folder.uri.fsPath];
  if (dryRun) {
    args.push("--dry-run");
  }
  runNodeCliInTerminal(folder.uri.fsPath, cli, args, "Cursor rules → CLAUDE.md (bundled)");
  return true;
}

/** Same argv as {@link runPortCursorMcpWithMode} / npx; bundled CLI only. */
export function runPortCursorMcpBundledWithMode(
  folder: vscode.WorkspaceFolder,
  mode: PortCursorMcpMode,
  quiet?: BundledBridgeQuiet
): boolean {
  const { packageName, bin } = TOOLBOX_BRIDGE_BINS.mcpPort;
  const cli = tryResolveToolboxPackageBin(packageName, bin);
  if (!cli) {
    if (!quiet?.quietMissing) {
      missingBundledCliMessage(packageName);
    }
    return false;
  }
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const args: string[] = [];
  if (mode === "dry") {
    args.push("--dry-run");
  } else if (mode === "user") {
    args.push("-t", insiders ? "insiders" : "user");
  }
  runNodeCliInTerminal(folder.uri.fsPath, cli, args, "Cursor MCP port (bundled)");
  return true;
}
