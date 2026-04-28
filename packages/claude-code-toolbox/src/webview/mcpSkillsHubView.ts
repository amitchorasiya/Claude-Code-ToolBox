import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import * as mcpConfig from "../mcpConfig";
import * as mcpPaths from "../mcpPaths";
import { installSkillFromSkillsSh } from "../commands/installSkillFromSkillsSh";
import { installMcpFromRegistryEntry } from "../registry/mcpRegistryInstall";
import { searchMcpRegistry } from "../registry/mcpRegistryClient";
import { searchSkillsSh } from "../registry/skillsShClient";
import { collectLocalSkills, type SkillEntry } from "../skills/localSkills";
import {
  applyHubDisabledFlagsToSkills,
  setSkillHubDisabled,
  setSkillHubEnabled,
} from "../skills/skillHubState";
import {
  buildMcpServerRowsForHub,
  mcpHubDeleteServer,
  mcpHubTurnOffServer,
  mcpHubTurnOnServer,
} from "../mcpHubMutations";
import { gatherWorkspaceKitSnapshot, type KitSnapshotRow } from "../tree/workspaceKitProvider";
import { getHubWebviewHtml } from "./hubWebviewDocument";
import { deleteSkillFolderFromHub } from "../commands/deleteSkillFolder";
import { collectLocalAgents, type AgentEntry, type AgentRole } from "../agents/localAgents";
import {
  collectLocalTeams,
  createTeam,
  deleteTeam,
  runtimeForProtocol,
  updateTeam,
  type TeamDraft,
  type TeamEntry,
  type TeamProtocol,
} from "../agents/teamsStore";
import {
  createAgent,
  deleteAgent,
  updateAgent,
  type AgentDraft,
} from "../agents/agentsMutations";
import { checkClaudeCli } from "../agents/claudeCliResolver";
import {
  enableAgentTeams,
  revealAgentsFolder,
} from "../commands/enableAgentTeams";
import {
  SDLC_STARTER_PACK,
  installSdlcStarterPack,
  starterPackDefaultSelection,
  writePresetTeamsIfEligible,
  type StarterPackAgent,
} from "../agents/starterPack";
import {
  commandsPackDefaultSelection,
  installCommandsPack,
  listInstalledCommands,
  uninstallCommandsPack,
  type InstalledCommand,
} from "../agents/commandsPack";
import {
  createCommand,
  updateCommand,
  deleteCommand,
  readCommandBody,
  parseAgentsFromBody,
  type CommandDraft,
} from "../agents/commandsMutations";
import { TOOLBOX_SETTINGS_PREFIX, safeUpdateToolboxSetting } from "../toolboxSettings";
import {
  startTeamRun,
  resolvePendingApproval,
  abortRun,
} from "../agents/runtime/runOrchestrator";
import { getRun, listActiveRuns } from "../agents/runtime/runRegistry";
import type { AgentRunEvent, RunPhase, RunStatus } from "../agents/runtime/eventTypes";
import type {
  DashboardController,
  DashboardState,
} from "../agents/dashboard/dashboardController";
import type { SessionCard } from "../agents/dashboard/sessionStore";
import { attachRunBusToStore } from "../agents/dashboard/sessionBridge";

export type { SkillEntry };

export type AgentTeamsEnableStatus = {
  agentsDirExists: boolean;
  agentsDirPath: string;
  agentsCount: number;
  cliOk: boolean;
  cliPath?: string;
  cliReason?: string;
};

export type StarterPackRow = {
  id: string;
  title: string;
  role: AgentRole;
  model: string;
  color: string;
  description: string;
  defaultSelected: boolean;
  installed: boolean;
};

export type ActiveRunRow = {
  runId: string;
  teamId: string;
  teamName: string;
  protocol: string;
  runtime: "native" | "custom";
  phase: RunPhase;
  status: RunStatus;
  startedAt: string;
  awaitingApprovalPlanPath?: string;
};

export type McpServerRow = {
  id: string;
  kind: string;
  detail: string;
  scope: "workspace" | "user";
  /** When true, config is stored by the Toolbox (not in mcp.json) until Turn ON. */
  disabled?: boolean;
};

export type HubHygiene = {
  workspaceMcpServerCount: number;
  userMcpServerCount: number;
  /** `CLAUDE.md` — line count when present. */
  claudeMdLines: number | null;
  claudeMdMissing: boolean;
};

export type HubPayload = {
  workspaceName?: string;
  workspaceServers: McpServerRow[];
  userServers: McpServerRow[];
  workspaceMcp: "missing" | "empty" | "ok";
  userMcp: "missing" | "empty" | "ok";
  skills: SkillEntry[];
  kit: KitSnapshotRow[];
  /** Mirrors `cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen`. */
  autoScanMcpSkillsOnWorkspaceOpen: boolean;
  /** Mirrors `cloude-code-toolbox.thinkingMachineMode.enabled`. */
  thinkingMachineModeEnabled: boolean;
  /** File/config snapshot for the Thinking Machine hub (not token usage). */
  hygiene: HubHygiene;
  /** Set when `gatherHubPayload` failed; UI still loads with `emptyHubPayload()` defaults. */
  hubLoadError?: string;
  /** Shared hub HTML: JetBrains hides duplicate npx vs bundled bridge buttons. */
  hubHost?: "vscode" | "intellij";
  /** Agent Teams — discovered agent `.md` files (user + workspace scope). */
  agents: AgentEntry[];
  /** Agent Teams — discovered team `.json` compositions. */
  teams: TeamEntry[];
  /** Agent Teams — enable status (dir + CLI presence). */
  agentTeamsEnableStatus: AgentTeamsEnableStatus;
  /** Agent Teams — starter pack catalog + per-agent install state. */
  starterPack: StarterPackRow[];
  /** Agent Teams — feature flag (user can hide the tab). */
  agentTeamsEnabled: boolean;
  /** Agent Teams — default protocol setting. */
  agentTeamsDefaultProtocol: TeamProtocol;
  /** Agent Teams — default model setting. */
  agentTeamsDefaultModel: string;
  /** Agent Teams — snapshot of currently running or approval-blocked runs. */
  activeRuns: ActiveRunRow[];
  /** Slash-command bridges installed on disk (both scopes). */
  slashCommands: InstalledCommand[];
  /** Phase 1 dashboard: live cards for every Claude session discovered on the machine. */
  sessionCards: SessionCard[];
  /** Phase 1 dashboard status (hook installer + server port). */
  agentDashboard: {
    enabled: boolean;
    running: boolean;
    port: number | null;
    sessionsDiscovered: number;
    installed: boolean;
    safetyGuardInstalled: boolean;
    autoPairPlanningPrompts: boolean;
    defaultPairTeamName: string;
    retainDoneCardsMs: number;
    foreignHooks: string[];
    lastError?: string;
  };
};

export async function gatherHubPayload(
  context: vscode.ExtensionContext,
  controller?: DashboardController
): Promise<HubPayload> {
  const cfg = vscode.workspace.getConfiguration();
  const insiders = cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true;
  const folder = mcpPaths.getPrimaryWorkspaceFolder();

  let workspaceServers: McpServerRow[] = [];
  let workspaceMcp: HubPayload["workspaceMcp"] = "missing";
  if (folder) {
    const uri = mcpPaths.workspaceMcpUri(folder);
    const parsed = await mcpConfig.parseMcpServers(uri);
    if (parsed === undefined) {
      workspaceMcp = "missing";
    } else if (parsed.length === 0) {
      workspaceMcp = "empty";
    } else {
      workspaceMcp = "ok";
    }
    workspaceServers = await buildMcpServerRowsForHub(context, uri, "workspace");
  }

  const userUri = vscode.Uri.file(mcpPaths.userMcpJsonPath(insiders));
  const userParsed = await mcpConfig.parseMcpServers(userUri);
  let userMcp: HubPayload["userMcp"] = "missing";
  let userServers: McpServerRow[] = [];
  if (userParsed === undefined) {
    userMcp = "missing";
  } else if (userParsed.length === 0) {
    userMcp = "empty";
  } else {
    userMcp = "ok";
  }
  userServers = await buildMcpServerRowsForHub(context, userUri, "user");

  const rawSkills = await collectLocalSkills(os.homedir(), folder?.uri.fsPath);
  const skills = await applyHubDisabledFlagsToSkills(context, rawSkills);

  const kit = await gatherWorkspaceKitSnapshot();

  /* Agent Teams — new tab state. */
  const homeDir = os.homedir();
  const workspaceRoot = folder?.uri.fsPath;
  const agents = await collectLocalAgents(homeDir, workspaceRoot);
  const teams = await collectLocalTeams(homeDir, workspaceRoot);
  const userAgentsDir = path.join(homeDir, ".claude", "agents");
  let agentsDirExists = false;
  try {
    await fs.access(userAgentsDir);
    agentsDirExists = true;
  } catch {
    agentsDirExists = false;
  }
  const cliOverride = cfg.get<string>(`${TOOLBOX_SETTINGS_PREFIX}.agentTeams.claudeBinOverride`, "");
  const cliStatus = await checkClaudeCli(cliOverride);
  const agentTeamsEnableStatus: AgentTeamsEnableStatus = {
    agentsDirExists,
    agentsDirPath: userAgentsDir,
    agentsCount: agents.length,
    cliOk: cliStatus.ok,
    cliPath: cliStatus.binPath,
    cliReason: cliStatus.reason,
  };
  const installedNames = new Set(agents.map((a) => a.name));
  const starterPack: StarterPackRow[] = SDLC_STARTER_PACK.map((a: StarterPackAgent) => ({
    id: a.id,
    title: a.title,
    role: a.role,
    model: a.model,
    color: a.color,
    description: a.description,
    defaultSelected: a.defaultSelected,
    installed: installedNames.has(a.id),
  }));
  const agentTeamsEnabled =
    cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.agentTeams.enabled`, true) === true;
  const agentTeamsDefaultProtocol = (cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.defaultProtocol`,
    "native-task"
  ) ?? "native-task") as TeamProtocol;
  const agentTeamsDefaultModel = cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.defaultModel`,
    "claude-sonnet-4-5"
  );
  const slashCommands = await listInstalledCommands(homeDir, workspaceRoot).catch(() => []);
  const activeRuns: ActiveRunRow[] = listActiveRuns().map((r) => ({
    runId: r.runId,
    teamId: r.teamId,
    teamName: r.teamName,
    protocol: r.protocol,
    runtime: r.runtime,
    phase: r.phase,
    status: r.status,
    startedAt: r.startedAt,
    awaitingApprovalPlanPath: r.pendingApproval?.planPath,
  }));

  const autoScanMcpSkillsOnWorkspaceOpen =
    cfg.get<boolean>("cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen") === true;
  const thinkingMachineModeEnabled =
    cfg.get<boolean>("cloude-code-toolbox.thinkingMachineMode.enabled") === true;

  let claudeMdLines: number | null = null;
  let claudeMdMissing = true;
  if (folder) {
    const instr = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
    try {
      const buf = await vscode.workspace.fs.readFile(instr);
      claudeMdMissing = false;
      const text = new TextDecoder().decode(buf);
      claudeMdLines = text.split(/\r?\n/).length;
    } catch {
      claudeMdMissing = true;
    }
  }

  const hygiene: HubHygiene = {
    workspaceMcpServerCount: workspaceServers.filter((s) => !s.disabled).length,
    userMcpServerCount: userServers.filter((s) => !s.disabled).length,
    claudeMdLines,
    claudeMdMissing,
  };

  return {
    workspaceName: folder?.name,
    workspaceServers,
    userServers,
    workspaceMcp,
    userMcp,
    skills,
    kit,
    autoScanMcpSkillsOnWorkspaceOpen,
    thinkingMachineModeEnabled,
    hygiene,
    hubHost: "vscode",
    agents,
    teams,
    agentTeamsEnableStatus,
    starterPack,
    agentTeamsEnabled,
    agentTeamsDefaultProtocol,
    agentTeamsDefaultModel,
    activeRuns,
    slashCommands,
    sessionCards: controller?.store.snapshot().cards ?? [],
    agentDashboard: await gatherAgentDashboardPayload(cfg, controller),
  };
}

async function gatherAgentDashboardPayload(
  cfg: vscode.WorkspaceConfiguration,
  controller: DashboardController | undefined
): Promise<HubPayload["agentDashboard"]> {
  const enabled =
    cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.enabled`, false) === true;
  const autoPair =
    cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.autoPairPlanningPrompts`, false) ===
    true;
  const defaultPairTeamName = cfg.get<string>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.defaultPairTeamName`,
    "sdlc-debate"
  );
  const retainDoneCardsMs = cfg.get<number>(
    `${TOOLBOX_SETTINGS_PREFIX}.agentDashboard.retainDoneCardsMs`,
    60_000
  );
  if (!controller) {
    return {
      enabled,
      running: false,
      port: null,
      sessionsDiscovered: 0,
      installed: false,
      safetyGuardInstalled: false,
      autoPairPlanningPrompts: autoPair,
      defaultPairTeamName,
      retainDoneCardsMs,
      foreignHooks: [],
    };
  }
  let state: DashboardState;
  try {
    state = await controller.currentState();
  } catch {
    return {
      enabled,
      running: false,
      port: null,
      sessionsDiscovered: 0,
      installed: false,
      safetyGuardInstalled: false,
      autoPairPlanningPrompts: autoPair,
      defaultPairTeamName,
      retainDoneCardsMs,
      foreignHooks: [],
    };
  }
  return {
    enabled,
    running: state.running,
    port: state.port,
    sessionsDiscovered: state.sessionsDiscovered,
    installed: state.installerStatus?.installed ?? false,
    safetyGuardInstalled: state.installerStatus?.safetyGuardInstalled ?? false,
    autoPairPlanningPrompts: autoPair,
    defaultPairTeamName,
    retainDoneCardsMs,
    foreignHooks: state.foreignHooks ?? [],
    lastError: state.lastError,
  };
}

/** Safe defaults when `gatherHubPayload` throws so the hub webview can still render. */
export function emptyHubPayload(): HubPayload {
  return {
    workspaceServers: [],
    userServers: [],
    workspaceMcp: "missing",
    userMcp: "missing",
    skills: [],
    kit: [],
    autoScanMcpSkillsOnWorkspaceOpen: false,
    thinkingMachineModeEnabled: false,
    hygiene: {
      workspaceMcpServerCount: 0,
      userMcpServerCount: 0,
      claudeMdLines: null,
      claudeMdMissing: true,
    },
    hubHost: "vscode",
    agents: [],
    teams: [],
    agentTeamsEnableStatus: {
      agentsDirExists: false,
      agentsDirPath: path.join(os.homedir(), ".claude", "agents"),
      agentsCount: 0,
      cliOk: false,
    },
    starterPack: SDLC_STARTER_PACK.map((a) => ({
      id: a.id,
      title: a.title,
      role: a.role,
      model: a.model,
      color: a.color,
      description: a.description,
      defaultSelected: a.defaultSelected,
      installed: false,
    })),
    agentTeamsEnabled: true,
    agentTeamsDefaultProtocol: "native-task",
    agentTeamsDefaultModel: "claude-sonnet-4-5",
    activeRuns: [],
    slashCommands: [],
    sessionCards: [],
    agentDashboard: {
      enabled: false,
      running: false,
      port: null,
      sessionsDiscovered: 0,
      installed: false,
      safetyGuardInstalled: false,
      autoPairPlanningPrompts: false,
      defaultPairTeamName: "sdlc-debate",
      retainDoneCardsMs: 60_000,
      foreignHooks: [],
    },
  };
}

const HUB_PAYLOAD_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Activity bar (Cloude Code ToolBox) — first view */
export const MCP_SKILLS_HUB_VIEW_ACTIVITY = "cloudeCodeKitMcp";
/** Secondary sidebar container — webview tab beside Chat (see `package.json` `secondarySidebar`) */
export const MCP_SKILLS_HUB_VIEW_SECONDARY = "cloudeCodeKitMcpSecondary";

export class McpSkillsHubViewProvider implements vscode.WebviewViewProvider {
  /** @deprecated Use MCP_SKILLS_HUB_VIEW_ACTIVITY */
  public static readonly viewType = MCP_SKILLS_HUB_VIEW_ACTIVITY;

  private _view?: vscode.WebviewView;
  /** Serialize hub refreshes so parallel `gatherHubPayload` calls cannot stack on slow disks. */
  private _hubPostChain: Promise<void> = Promise.resolve();
  /** runId → unsubscribe function for `bus.on`. Cleared on `run_end`. */
  private _runSubscriptions = new Map<string, () => void>();
  /** Unsubscribe function for the Agent Dashboard store push channel. */
  private _dashboardSubscription?: () => void;

  constructor(
    private readonly _ctx: vscode.ExtensionContext,
    private readonly _dashboard?: DashboardController
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready":
        case "refresh":
          this._postState();
          break;
        case "runCommand":
          if (typeof msg.command === "string") {
            try {
              await vscode.commands.executeCommand(msg.command);
            } catch {
              vscode.window.showErrorMessage(`Command failed: ${msg.command}`);
            }
          }
          this._postState();
          break;
        case "runCommandWithArgs":
          if (typeof msg.command === "string" && Array.isArray(msg.args)) {
            try {
              await vscode.commands.executeCommand(msg.command, ...(msg.args as unknown[]));
            } catch {
              vscode.window.showErrorMessage(`Command failed: ${msg.command}`);
            }
          }
          this._postState();
          break;
        case "openFile":
          if (typeof msg.fsPath === "string") {
            const u = vscode.Uri.file(msg.fsPath);
            try {
              await vscode.window.showTextDocument(u);
            } catch {
              vscode.window.showErrorMessage(`Could not open: ${msg.fsPath}`);
            }
          }
          break;
        case "revealPath":
          if (typeof msg.fsPath === "string") {
            const u = vscode.Uri.file(msg.fsPath);
            try {
              const stat = await vscode.workspace.fs.stat(u);
              if ((stat.type & vscode.FileType.Directory) !== 0) {
                await vscode.commands.executeCommand("revealInExplorer", u);
              } else {
                await vscode.commands.executeCommand("revealFileInOS", u);
              }
            } catch {
              vscode.window.showErrorMessage(`Could not reveal: ${msg.fsPath}`);
            }
          }
          break;
        case "registrySearch": {
          const generation = typeof msg.generation === "number" ? msg.generation : 0;
          const search = typeof msg.search === "string" ? msg.search : "";
          const cursor = typeof msg.cursor === "string" ? msg.cursor : undefined;
          const append = msg.append === true;
          try {
            const { servers, metadata } = await searchMcpRegistry({
              search,
              limit: 12,
              cursor,
            });
            this._view?.webview.postMessage({
              type: "registrySearchResult",
              generation,
              append,
              servers,
              nextCursor: metadata.nextCursor,
              error: null,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this._view?.webview.postMessage({
              type: "registrySearchResult",
              generation,
              append: false,
              servers: [],
              nextCursor: undefined,
              error: message,
            });
          }
          break;
        }
        case "skillSearch": {
          const generation = typeof msg.generation === "number" ? msg.generation : 0;
          const query = typeof msg.query === "string" ? msg.query : "";
          try {
            const items = await searchSkillsSh(query, { limit: 15 });
            this._view?.webview.postMessage({
              type: "skillSearchResult",
              generation,
              items,
              error: null,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this._view?.webview.postMessage({
              type: "skillSearchResult",
              generation,
              items: [],
              error: message,
            });
          }
          break;
        }
        case "installMcpRegistry":
          await installMcpFromRegistryEntry(msg.entry);
          this._postState();
          break;
        case "installSkillSh":
          if (typeof msg.source === "string" && typeof msg.skillId === "string") {
            await installSkillFromSkillsSh({
              source: msg.source,
              skillId: msg.skillId,
              global: msg.global === true,
            });
          }
          this._postState();
          break;
        case "setAutoScanMcpSkillsOnWorkspaceOpen": {
          const hasWs = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
          await vscode.workspace.getConfiguration().update(
            "cloude-code-toolbox.intelligence.autoScanMcpSkillsOnWorkspaceOpen",
            msg.value === true,
            hasWs ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global
          );
          this._postState();
          break;
        }
        case "setThinkingMachineModeEnabled": {
          const hasWs = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
          await vscode.workspace.getConfiguration().update(
            "cloude-code-toolbox.thinkingMachineMode.enabled",
            msg.value === true,
            hasWs ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global
          );
          this._postState();
          break;
        }
        case "mcpToggleServer": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const id = typeof msg.id === "string" ? msg.id : "";
          const enable = msg.enable === true;
          if (!id) {
            break;
          }
          try {
            if (enable) {
              await mcpHubTurnOnServer(this._ctx, scope, id);
            } else {
              await mcpHubTurnOffServer(this._ctx, scope, id);
            }
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MCP toggle failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "mcpDeleteServer": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const id = typeof msg.id === "string" ? msg.id : "";
          if (!id) {
            break;
          }
          try {
            await mcpHubDeleteServer(this._ctx, scope, id);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`MCP remove failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "skillToggleHub": {
          const scope = msg.scope === "user" ? "user" : "workspace";
          const skillId = typeof msg.skillId === "string" ? msg.skillId : "";
          const enable = msg.enable === true;
          if (!skillId) {
            break;
          }
          try {
            if (enable) {
              await setSkillHubEnabled(this._ctx, scope, skillId);
            } else {
              await setSkillHubDisabled(this._ctx, scope, skillId);
            }
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Skill hub toggle failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "deleteSkillFolder": {
          const fsPath = typeof msg.fsPath === "string" ? msg.fsPath : "";
          const scope = msg.scope === "user" ? "user" : "workspace";
          if (!fsPath) {
            break;
          }
          await deleteSkillFolderFromHub(this._ctx, fsPath, scope);
          this._postState();
          break;
        }
        case "agentTeams.enable": {
          try {
            const scope: "user" | "workspace" =
              msg.scope === "workspace" ? "workspace" : "user";
            const installPack = msg.installStarterPack === true;
            const selection = Array.isArray(msg.starterPackSelection)
              ? (msg.starterPackSelection as unknown[]).filter(
                  (x): x is string => typeof x === "string"
                )
              : starterPackDefaultSelection();
            await enableAgentTeams({
              scope,
              installStarterPack: installPack,
              starterPackSelection: selection,
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Enable Agent Teams failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.installStarterPack": {
          try {
            const scope: "user" | "workspace" =
              msg.scope === "workspace" ? "workspace" : "user";
            const selection = Array.isArray(msg.selected)
              ? (msg.selected as unknown[]).filter((x): x is string => typeof x === "string")
              : starterPackDefaultSelection();
            const overwrite = msg.overwrite === true;
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const result = await installSdlcStarterPack({
              selected: selection,
              scope,
              homeDir: os.homedir(),
              workspaceRoot: folder?.uri.fsPath,
              overwrite,
            });
            const teamsBit = result.teamsWritten.length
              ? ` · ${result.teamsWritten.length} team(s) created`
              : "";
            vscode.window.showInformationMessage(
              `Starter pack: ${result.written.length} agents (${result.skipped.length} existed)${teamsBit} at ${result.targetDir}.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Starter pack install failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.createAgent": {
          try {
            const draft = msg.draft as AgentDraft | undefined;
            if (!draft || typeof draft.name !== "string") {
              throw new Error("Missing agent draft.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            await createAgent(draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(`Agent "${draft.name}" created.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Create agent failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.updateAgent": {
          try {
            const id = typeof msg.id === "string" ? msg.id : "";
            const draft = msg.draft as AgentDraft | undefined;
            if (!id || !draft) {
              throw new Error("Missing id or draft.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const agents = await collectLocalAgents(os.homedir(), folder?.uri.fsPath);
            const existing = agents.find((a) => a.id === id);
            if (!existing) {
              throw new Error(`Agent not found: ${id}`);
            }
            await updateAgent(existing, draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(`Agent "${draft.name}" updated.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Update agent failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.deleteAgent": {
          try {
            const id = typeof msg.id === "string" ? msg.id : "";
            if (!id) {
              throw new Error("Missing id.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const agents = await collectLocalAgents(os.homedir(), folder?.uri.fsPath);
            const existing = agents.find((a) => a.id === id);
            if (!existing) {
              throw new Error(`Agent not found: ${id}`);
            }
            const pick = await vscode.window.showWarningMessage(
              `Delete agent "${existing.name}" (${existing.scope})?`,
              { modal: true },
              "Delete",
              "Cancel"
            );
            if (pick !== "Delete") {
              break;
            }
            await deleteAgent(existing);
            vscode.window.showInformationMessage(`Agent "${existing.name}" deleted.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Delete agent failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.createTeam": {
          try {
            const draft = msg.draft as TeamDraft | undefined;
            if (!draft) {
              throw new Error("Missing team draft.");
            }
            draft.runtime = runtimeForProtocol(draft.protocol);
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            await createTeam(draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(`Team "${draft.name}" created.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Create team failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.updateTeam": {
          try {
            const id = typeof msg.id === "string" ? msg.id : "";
            const draft = msg.draft as TeamDraft | undefined;
            if (!id || !draft) {
              throw new Error("Missing id or draft.");
            }
            draft.runtime = runtimeForProtocol(draft.protocol);
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const teams = await collectLocalTeams(os.homedir(), folder?.uri.fsPath);
            const existing = teams.find((t) => t.id === id);
            if (!existing) {
              throw new Error(`Team not found: ${id}`);
            }
            await updateTeam(existing, draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(`Team "${draft.name}" updated.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Update team failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.deleteTeam": {
          try {
            const id = typeof msg.id === "string" ? msg.id : "";
            if (!id) {
              throw new Error("Missing id.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const teams = await collectLocalTeams(os.homedir(), folder?.uri.fsPath);
            const existing = teams.find((t) => t.id === id);
            if (!existing) {
              throw new Error(`Team not found: ${id}`);
            }
            const pick = await vscode.window.showWarningMessage(
              `Delete team "${existing.name}" (${existing.scope})?`,
              { modal: true },
              "Delete",
              "Cancel"
            );
            if (pick !== "Delete") {
              break;
            }
            await deleteTeam(existing);
            vscode.window.showInformationMessage(`Team "${existing.name}" deleted.`);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Delete team failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.revealAgentsFolder": {
          const scope = msg.scope === "workspace" ? "workspace" : "user";
          revealAgentsFolder(scope);
          break;
        }
        case "agentTeams.openAgentFile": {
          if (typeof msg.fsPath === "string") {
            try {
              await vscode.window.showTextDocument(vscode.Uri.file(msg.fsPath));
            } catch {
              vscode.window.showErrorMessage(`Could not open: ${msg.fsPath}`);
            }
          }
          break;
        }
        case "agentTeams.installCommandsPack": {
          try {
            const scope: "user" | "workspace" =
              msg.scope === "workspace" ? "workspace" : "user";
            const selection = Array.isArray(msg.selected)
              ? (msg.selected as unknown[]).filter((x): x is string => typeof x === "string")
              : commandsPackDefaultSelection();
            const overwrite = msg.overwrite === true;
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const result = await installCommandsPack({
              selected: selection,
              scope,
              homeDir: os.homedir(),
              workspaceRoot: folder?.uri.fsPath,
              overwrite,
            });
            vscode.window.showInformationMessage(
              `Slash commands: installed ${result.written.length} (${result.skipped.length} existed / foreign) at ${result.targetDir}. Type /<tab> inside claude to see them.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Install slash commands failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.uninstallCommandsPack": {
          try {
            const scope: "user" | "workspace" =
              msg.scope === "workspace" ? "workspace" : "user";
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const result = await uninstallCommandsPack({
              scope,
              homeDir: os.homedir(),
              workspaceRoot: folder?.uri.fsPath,
            });
            vscode.window.showInformationMessage(
              `Slash commands: removed ${result.removed.length} file(s) from ${result.targetDir ?? "(no dir)"}.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Uninstall slash commands failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.createCommand": {
          try {
            const draft = msg.draft as CommandDraft | undefined;
            if (!draft || typeof draft.name !== "string") {
              throw new Error("Missing command draft.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            await createCommand(draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(
              `Slash command "/${draft.name}" created. Type /<tab> inside claude to see it.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Create command failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.updateCommand": {
          try {
            const filePath = typeof msg.filePath === "string" ? msg.filePath : "";
            const draft = msg.draft as CommandDraft | undefined;
            if (!filePath || !draft) {
              throw new Error("Missing filePath or draft.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const commands = await listInstalledCommands(
              os.homedir(),
              folder?.uri.fsPath
            );
            const existing = commands.find((c) => c.filePath === filePath);
            if (!existing) {
              throw new Error(`Command not found: ${filePath}`);
            }
            await updateCommand(existing, draft, os.homedir(), folder?.uri.fsPath);
            vscode.window.showInformationMessage(
              `Slash command "/${draft.name}" updated.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Update command failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.deleteCommand": {
          try {
            const filePath = typeof msg.filePath === "string" ? msg.filePath : "";
            if (!filePath) {
              throw new Error("Missing filePath.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const commands = await listInstalledCommands(
              os.homedir(),
              folder?.uri.fsPath
            );
            const existing = commands.find((c) => c.filePath === filePath);
            if (!existing) {
              throw new Error(`Command not found: ${filePath}`);
            }
            const pick = await vscode.window.showWarningMessage(
              `Delete slash command "/${existing.id}" (${existing.scope})?`,
              { modal: true },
              "Delete",
              "Cancel"
            );
            if (pick !== "Delete") break;
            await deleteCommand(existing);
            vscode.window.showInformationMessage(
              `Slash command "/${existing.id}" deleted.`
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Delete command failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.readCommandBody": {
          try {
            const filePath = typeof msg.filePath === "string" ? msg.filePath : "";
            if (!filePath) throw new Error("Missing filePath.");
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const commands = await listInstalledCommands(
              os.homedir(),
              folder?.uri.fsPath
            );
            const existing = commands.find((c) => c.filePath === filePath);
            if (!existing) throw new Error(`Command not found: ${filePath}`);
            const body = await readCommandBody(existing);
            const agents = parseAgentsFromBody(body);
            this._view?.webview.postMessage({
              type: "agentTeams.commandBody",
              filePath,
              body,
              agents,
            });
          } catch {
            this._view?.webview.postMessage({
              type: "agentTeams.commandBody",
              filePath: msg.filePath,
              body: "",
              agents: [],
            });
          }
          break;
        }
        case "agentTeams.runTeam": {
          try {
            const id = typeof msg.teamId === "string" ? msg.teamId : "";
            const prompt = typeof msg.prompt === "string" ? msg.prompt.trim() : "";
            if (!id || !prompt) {
              throw new Error("Missing teamId or prompt.");
            }
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const teams = await collectLocalTeams(os.homedir(), folder?.uri.fsPath);
            const team = teams.find((t) => t.id === id);
            if (!team) {
              throw new Error(`Team not found: ${id}`);
            }
            const agents = await collectLocalAgents(os.homedir(), folder?.uri.fsPath);
            const configuration = vscode.workspace.getConfiguration();
            const claudeBin = configuration.get<string>(
              `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.claudeBinOverride`,
              ""
            );
            const maxConcurrent = configuration.get<number>(
              `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.maxConcurrentAgents`,
              3
            );
            const budgetUsd = configuration.get<number>(
              `${TOOLBOX_SETTINGS_PREFIX}.agentTeams.costCapUsd`,
              0
            );
            const dashboard = this._dashboard;
            const { run, finished } = startTeamRun({
              team,
              agents,
              userPrompt: prompt,
              workspaceRoot: folder?.uri.fsPath,
              claudeBin: claudeBin || undefined,
              maxConcurrentAgents: maxConcurrent,
              budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
              onStarted: (r) => {
                if (!dashboard) return;
                try {
                  /* Bridge: mirror RunBus events into the dashboard store. */
                  attachRunBusToStore(r.bus, dashboard.store, {
                    team,
                    cwd: folder?.uri.fsPath,
                    budgetUsd: budgetUsd > 0 ? budgetUsd : undefined,
                  });
                } catch {
                  /* ignore bridge failures */
                }
              },
            });
            this._subscribeRunEvents(run.runId);
            finished
              .then((r) => {
                this._view?.webview.postMessage({
                  type: "agentTeams.runEnded",
                  runId: run.runId,
                  status: r.status,
                  planArtifactPath: r.planArtifactPath,
                });
                this._postState();
              })
              .catch(() => {
                this._postState();
              });
            this._view?.webview.postMessage({
              type: "agentTeams.runStarted",
              runId: run.runId,
              teamId: team.id,
              teamName: team.name,
              protocol: team.protocol,
              runtime: team.runtime,
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Run team failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentTeams.stopRun": {
          const id = typeof msg.runId === "string" ? msg.runId : "";
          const r = id ? getRun(id) : undefined;
          if (r) {
            abortRun(r);
          }
          this._postState();
          break;
        }
        case "agentTeams.approvePlan":
        case "agentTeams.rejectPlan": {
          const id = typeof msg.runId === "string" ? msg.runId : "";
          const r = id ? getRun(id) : undefined;
          if (r) {
            const decision = msg.type === "agentTeams.approvePlan" ? "approve" : "reject";
            const reason = typeof msg.reason === "string" ? msg.reason : undefined;
            resolvePendingApproval(r, decision, reason);
          }
          this._postState();
          break;
        }
        case "agentTeams.openRun": {
          const id = typeof msg.runId === "string" ? msg.runId : "";
          const r = id ? getRun(id) : undefined;
          if (r) {
            try {
              await vscode.window.showTextDocument(vscode.Uri.file(r.jsonlPath));
            } catch {
              /* fallthrough */
            }
          }
          break;
        }
        case "agentDashboard.enable": {
          if (!this._dashboard) {
            vscode.window.showWarningMessage("Agent Dashboard is not available in this host.");
            this._postState();
            break;
          }
          try {
            await safeUpdateToolboxSetting("agentDashboard.enabled", true);
            await this._dashboard.start();
            const folder = mcpPaths.getPrimaryWorkspaceFolder();
            const teams = await writePresetTeamsIfEligible({
              scope: "user",
              homeDir: os.homedir(),
              workspaceRoot: folder?.uri.fsPath,
            });
            if (teams.length) {
              vscode.window.showInformationMessage(
                `Agent Dashboard enabled · ${teams.length} default team(s) created · Claude sessions will appear above the run panels.`
              );
            } else {
              vscode.window.showInformationMessage(
                "Agent Dashboard enabled — Claude sessions will appear above the run panels."
              );
            }
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Enable Agent Dashboard failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentDashboard.disable": {
          if (!this._dashboard) {
            this._postState();
            break;
          }
          try {
            await this._dashboard.stop();
            await safeUpdateToolboxSetting("agentDashboard.enabled", false);
            vscode.window.showInformationMessage(
              "Agent Dashboard disabled — hook entries and helper removed."
            );
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`Disable Agent Dashboard failed: ${m}`);
          }
          this._postState();
          break;
        }
        case "agentDashboard.status": {
          if (this._dashboard) {
            const s = await this._dashboard.currentState();
            vscode.window.showInformationMessage(
              `Agent Dashboard: ${s.running ? "running" : "stopped"} · port ${s.port ?? "n/a"} · ${s.sessionsDiscovered} session(s)`
            );
          }
          break;
        }
        case "agentDashboard.revealSettingsJson": {
          const home = os.homedir();
          const p = path.join(home, ".claude", "settings.json");
          try {
            await vscode.window.showTextDocument(vscode.Uri.file(p));
          } catch {
            vscode.window.showWarningMessage(`Not found: ${p}`);
          }
          break;
        }
        case "agentDashboard.revealSessionTranscript": {
          const id = typeof msg.sessionId === "string" ? msg.sessionId : "";
          if (!id || !this._dashboard) break;
          const card = this._dashboard.store.getCard(id);
          if (!card) break;
          if (card.runId) {
            const r = getRun(card.runId);
            if (r) {
              try {
                await vscode.window.showTextDocument(vscode.Uri.file(r.jsonlPath));
              } catch {
                /* ignore */
              }
            }
            break;
          }
          const projects = path.join(os.homedir(), ".claude", "projects");
          try {
            await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(projects));
          } catch {
            /* ignore */
          }
          break;
        }
        case "agentDashboard.pinSession": {
          const id = typeof msg.sessionId === "string" ? msg.sessionId : "";
          if (this._dashboard && id) this._dashboard.store.pin(id, true);
          break;
        }
        case "agentDashboard.unpinSession": {
          const id = typeof msg.sessionId === "string" ? msg.sessionId : "";
          if (this._dashboard && id) this._dashboard.store.pin(id, false);
          break;
        }
        case "agentDashboard.acknowledgeAlert": {
          const id = typeof msg.sessionId === "string" ? msg.sessionId : "";
          const aid = typeof msg.alertId === "string" ? msg.alertId : "";
          if (this._dashboard && id && aid) this._dashboard.store.acknowledgeSafetyAlert(id, aid);
          break;
        }
        default:
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._postState();
      }
    });

    /* Push dashboard updates without a full hub refresh. */
    if (this._dashboard) {
      this._dashboardSubscription?.();
      this._dashboardSubscription = this._dashboard.onChange((snapshot) => {
        this._view?.webview.postMessage({
          type: "agentDashboard.update",
          cards: snapshot.cards,
          generatedAt: snapshot.generatedAt,
        });
      });
    }
    webviewView.onDidDispose(() => {
      this._dashboardSubscription?.();
      this._dashboardSubscription = undefined;
    });
  }

  refresh(): void {
    this._postState();
  }

  /** Subscribe this webview to a run's event stream; auto-unsubscribes on run_end. */
  private _subscribeRunEvents(runId: string): void {
    const run = getRun(runId);
    if (!run) {
      return;
    }
    const existing = this._runSubscriptions.get(runId);
    if (existing) {
      existing();
    }
    const off = run.bus.on((event: AgentRunEvent) => {
      this._view?.webview.postMessage({
        type: "agentTeams.runEvent",
        runId,
        event,
      });
      if (event.kind === "phase_boundary" && event.needsApproval) {
        this._view?.webview.postMessage({
          type: "agentTeams.phaseBoundary",
          runId,
          needsApproval: true,
          planPath: event.planPath,
        });
      }
      if (event.kind === "run_end") {
        const un = this._runSubscriptions.get(runId);
        this._runSubscriptions.delete(runId);
        if (un) {
          try {
            un();
          } catch {
            /* ignore */
          }
        }
      }
    });
    this._runSubscriptions.set(runId, off);
  }

  /** Enqueue a hub payload refresh (serialized; safe to call from message handlers). */
  private _postState(): void {
    this._hubPostChain = this._hubPostChain
      .then(() => this._postStateOnce())
      .catch((e) => {
        console.error("[Cloude Code ToolBox] hub post chain", e);
      });
  }

  private async _postStateOnce(): Promise<void> {
    if (!this._view) {
      return;
    }
    let payload: HubPayload;
    try {
      payload = await withTimeout(
        gatherHubPayload(this._ctx, this._dashboard),
        HUB_PAYLOAD_TIMEOUT_MS
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Cloude Code ToolBox] gatherHubPayload failed or timed out", e);
      const hint =
        message.includes("timed out") || message.includes("timeout")
          ? `Timed out after ${HUB_PAYLOAD_TIMEOUT_MS / 1000}s (slow or remote workspace disk). Try opening a local folder or reload the window.`
          : message;
      payload = { ...emptyHubPayload(), hubLoadError: hint };
    }
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({ type: "state", payload });
  }

  private _getHtml(): string {
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'unsafe-inline'",
    ].join("; ");
    return getHubWebviewHtml(csp);
  }
}
