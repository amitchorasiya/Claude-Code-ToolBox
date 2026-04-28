/**
 * "Enable Claude Agent Teams" hero-button handler.
 *
 * Agent teams are built into Claude Code — not gated by a settings flag —
 * so "enable" here means:
 *   1. Ensure `~/.claude/agents/` (or `<ws>/.claude/agents/`) exists.
 *   2. Verify the `claude` CLI is on PATH.
 *   3. Optionally install the SDLC starter pack.
 *   4. Flip our local UI flag so the hub shows the populated 3-pane view.
 *
 * Idempotent: re-running with agents already on disk just refreshes status.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { agentsDirForScope } from "../agents/localAgents";
import { checkClaudeCli } from "../agents/claudeCliResolver";
import {
  installSdlcStarterPack,
  starterPackDefaultSelection,
  writePresetTeamsIfEligible,
  type StarterPackInstallResult,
} from "../agents/starterPack";
import { TOOLBOX_SETTINGS_PREFIX, safeUpdateToolboxSetting } from "../toolboxSettings";

export type EnableAgentTeamsOptions = {
  scope?: "user" | "workspace";
  installStarterPack?: boolean;
  starterPackSelection?: readonly string[];
  /** When set, overrides the setting-based override lookup (for tests). */
  claudeBinOverride?: string;
};

export type EnableAgentTeamsResult = {
  scope: "user" | "workspace";
  agentsDir: string;
  createdDir: boolean;
  cliOk: boolean;
  cliPath?: string;
  cliReason?: string;
  starterPack?: StarterPackInstallResult;
  /** Paths of preset team JSONs written (e.g. debate-team.json). */
  teamsWritten: string[];
  /** Swarm slash commands synced for written teams. */
  commandsSynced: string[];
};

function workspaceRootFsPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function ensureDir(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return false;
  } catch {
    await fs.mkdir(p, { recursive: true });
    return true;
  }
}

export async function enableAgentTeams(
  options: EnableAgentTeamsOptions = {}
): Promise<EnableAgentTeamsResult> {
  const cfg = vscode.workspace.getConfiguration();
  const scope: "user" | "workspace" = options.scope ?? "user";
  const homeDir = os.homedir();
  const workspaceRoot = workspaceRootFsPath();
  const agentsDir = agentsDirForScope(scope, homeDir, workspaceRoot);
  if (!agentsDir) {
    throw new Error("Open a workspace folder to enable workspace-scope agent teams.");
  }
  const createdDir = await ensureDir(agentsDir);

  const override =
    options.claudeBinOverride ??
    cfg.get<string>(`${TOOLBOX_SETTINGS_PREFIX}.agentTeams.claudeBinOverride`, "");
  const cliStatus = await checkClaudeCli(override);

  let starterPack: StarterPackInstallResult | undefined;
  if (options.installStarterPack) {
    starterPack = await installSdlcStarterPack({
      selected: options.starterPackSelection ?? starterPackDefaultSelection(),
      scope,
      homeDir,
      workspaceRoot,
    });
  }

  await safeUpdateToolboxSetting("agentTeams.enabled", true);

  /* Always (re)write preset teams if the required agents are on disk. Safe to
   * call even when the user didn't install the starter pack — if no eligible
   * agents exist, this is a no-op. */
  const teamsWritten = await writePresetTeamsIfEligible({
    scope,
    homeDir,
    workspaceRoot,
  });

  const commandsSynced = starterPack?.commandsSynced ?? [];

  const teamsBit = teamsWritten.length ? ` · ${teamsWritten.length} team(s)` : "";
  const cmdsBit = commandsSynced.length
    ? ` · ${commandsSynced.length} swarm command(s)`
    : "";
  if (createdDir) {
    vscode.window.showInformationMessage(
      `Agent Teams: created ${agentsDir}${starterPack ? ` · installed ${starterPack.written.length} starter-pack agents` : ""}${teamsBit}${cmdsBit}.`
    );
  } else if (starterPack) {
    vscode.window.showInformationMessage(
      `Agent Teams: installed ${starterPack.written.length} starter-pack agents (${starterPack.skipped.length} already existed)${teamsBit}${cmdsBit}.`
    );
  } else {
    vscode.window.showInformationMessage(
      `Agent Teams: ${agentsDir} ready${teamsBit}${cmdsBit}.`
    );
  }

  if (!cliStatus.ok) {
    void vscode.window
      .showWarningMessage(
        `Claude CLI not detected — install it to run agent teams. ${cliStatus.reason ?? ""}`,
        "Open Claude Code docs"
      )
      .then((pick) => {
        if (pick === "Open Claude Code docs") {
          void vscode.env.openExternal(vscode.Uri.parse("https://docs.claude.com/claude-code"));
        }
      });
  }

  return {
    scope,
    agentsDir,
    createdDir,
    cliOk: cliStatus.ok,
    cliPath: cliStatus.binPath,
    cliReason: cliStatus.reason,
    starterPack,
    teamsWritten,
    commandsSynced,
  };
}

export function revealAgentsFolder(scope: "user" | "workspace" = "user"): void {
  const homeDir = os.homedir();
  const workspaceRoot = workspaceRootFsPath();
  const dir = agentsDirForScope(scope, homeDir, workspaceRoot);
  if (!dir) {
    void vscode.window.showErrorMessage("Open a workspace folder to reveal its agents directory.");
    return;
  }
  void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(dir));
}

export function agentsFolderHint(homeDir: string): string {
  return path.join(homeDir, ".claude", "agents");
}
