import * as vscode from "vscode";
import { appendCursorrules } from "./commands/migrateCursorrules";
import { runMergeCopilotInstructionsIntoClaudeMdCommand } from "./commands/mergeCopilotInstructionsIntoClaudeMd";
import { openClaudeUserSettingsJson } from "./commands/openClaudeUserSettingsJson";
import { createCursorrulesTemplate } from "./commands/createCursorrulesTemplate";
import { openComposerHubPanel } from "./commands/composerPanel";
import { showEnvSyncChecklist } from "./commands/envSyncChecklist";
import { openInlineChatCursorStyle } from "./commands/inlineChatProxy";
import { initMemoryBank } from "./commands/memoryBankInit";
import { openClaudeCodeAccountDocs } from "./commands/openClaudeCodeAccountDocs";
import { openCursorClaudeReference } from "./commands/openReference";
import { openClaudeCodePanel } from "./commands/openClaudeCode";
import { openInstructionsPicker } from "./commands/openInstructionsPicker";
import {
  cursorRulesToClaudeWithoutNpx,
  manualPortCursorMcpWithoutNpx,
  memoryBankWithoutNpx,
  revealCopilotSkillFoldersWithoutNpx,
  revealSkillFoldersWithoutNpx,
} from "./commands/bridgeWithoutNpx";
import { portCursorMcp } from "./commands/portFromCursor";
import { syncCursorRules } from "./commands/rulesToCopilot";
import { runClaudeToolboxConfigScan } from "./commands/claudeToolboxConfigScan";
import { appendNotepadToMemoryBank } from "./commands/memoryBankFromNotepad";
import { applyBundledMcpRecipe } from "./commands/mcpRecipeCommand";
import { createSkillStubCommand } from "./commands/skillStubCommand";
import { runVerificationChecklist } from "./commands/verificationCommand";
import { runFirstWorkspaceTestTask } from "./commands/runFirstTestTask";
import { copySessionNotepadToClipboard, openSessionNotepad } from "./commands/sessionNotepad";
import { toggleMcpDiscovery } from "./commands/toggleDiscovery";
import { translateCursorContextInSelection } from "./commands/translateContext";
import {
  openIntelligenceRepoMemoryBank,
  openIntelligenceRepoMcpPort,
  openIntelligenceRepoRulesConverter,
  openIntelligenceToolboxRepos,
} from "./commands/openIntelligenceGithubRepos";
import { migrateCopilotSkillsToAgents } from "./commands/migrateCopilotSkillsToAgents";
import { migrateSkillsCursorToAgents } from "./commands/migrateSkillsCursorToAgents";
import { openIntelligenceSettings } from "./commands/openIntelligenceSettings";
import { openThinkingMachineModeSettings } from "./commands/openThinkingMachineModeSettings";
import { openOneClickSetupSettings, runOneClickSetup } from "./commands/oneClickSetup";
import { workspaceSetupWizard } from "./commands/workspaceSetupWizard";
import { runBuildContextPackFlow } from "./intelligence/contextPackCommand";
import { showMcpSkillsAwareness } from "./intelligence/mcpSkillsAwarenessCommand";
import { registerMcpSkillsAutoScanOnWorkspaceOpen } from "./intelligence/workspaceAutoScan";
import { showIntelligenceReadiness } from "./intelligence/readinessCommand";
import { runThinkingMachinePriming } from "./intelligence/thinkingMachineModeCommand";
import {
  maybeShowAutoScanDefaultMigrationToast,
  registerThinkingMachineModeActivation,
  thinkingMachineModeActivationStartupCheck,
} from "./intelligence/thinkingMachineModeActivation";
import * as mcpPaths from "./mcpPaths";
import { mcpAddServerNative, mcpBrowseRegistry } from "./registry/mcpInstall";
import { MCP_CMD } from "./tree/mcpTreeProvider";
import { WorkspaceKitProvider } from "./tree/workspaceKitProvider";
import {
  MCP_SKILLS_HUB_VIEW_ACTIVITY,
  MCP_SKILLS_HUB_VIEW_SECONDARY,
  McpSkillsHubViewProvider,
} from "./webview/mcpSkillsHubView";
import { migrateOneClickSetupToNewKeys } from "./oneClickSetupSettingsMigrate";
import {
  affectsToolboxSetting,
  migrateLegacyToolboxSettings,
  safeUpdateToolboxSetting,
} from "./toolboxSettings";
import { enableAgentTeams, revealAgentsFolder } from "./commands/enableAgentTeams";
import {
  installSdlcStarterPack,
  starterPackDefaultSelection,
} from "./agents/starterPack";
import { DashboardController } from "./agents/dashboard/dashboardController";
import { planWithTeamCommand } from "./commands/planWithTeam";
import { smartRouterCommand } from "./commands/smartRouter";
import { maybeOfferPlanPairing } from "./commands/pairExternalSession";
import { writePresetTeamsIfEligible } from "./agents/starterPack";
import {
  commandsPackDefaultSelection,
  installCommandsPack,
  listInstalledCommands,
  uninstallCommandsPack,
} from "./agents/commandsPack";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    await migrateLegacyToolboxSettings();
  } catch (e) {
    console.error("[Cloude Code ToolBox] migrateLegacyToolboxSettings failed", e);
  }
  try {
    await migrateOneClickSetupToNewKeys();
  } catch (e) {
    console.error("[Cloude Code ToolBox] migrateOneClickSetupToNewKeys failed", e);
  }
  void thinkingMachineModeActivationStartupCheck(context);
  void maybeShowAutoScanDefaultMigrationToast(context);

  /* Agent Dashboard (Phase 1) — construct the controller but do not start it
   * until the user explicitly enables via the Teams-tab disclosure card. */
  const cfgNow = vscode.workspace.getConfiguration();
  const agentDashboard = new DashboardController({
    preferredPort: cfgNow.get<number>("cloude-code-toolbox.agentDashboard.hookPort", 3456),
    retainDoneCardsMs: cfgNow.get<number>(
      "cloude-code-toolbox.agentDashboard.retainDoneCardsMs",
      60_000
    ),
    includeInternalRuns: cfgNow.get<boolean>(
      "cloude-code-toolbox.agentDashboard.includeInternalRuns",
      true
    ),
    installSafetyGuard: cfgNow.get<boolean>(
      "cloude-code-toolbox.agentDashboard.safetyAlerts",
      false
    ),
    safetyPatterns: cfgNow.get<string[]>(
      "cloude-code-toolbox.agentDashboard.safetyPatterns",
      []
    ),
  });
  context.subscriptions.push({
    dispose: () => void agentDashboard.dispose().catch(() => undefined),
  });
  /* Auto-start if user previously had it enabled. */
  if (cfgNow.get<boolean>("cloude-code-toolbox.agentDashboard.enabled", false)) {
    void agentDashboard.start().catch((e) => {
      console.error("[Cloude Code ToolBox] agent dashboard start failed", e);
    });
  }
  /* Subscribe auto-pair heuristic — cheap, no-op when the setting is off. */
  agentDashboard.onChange((snapshot) => {
    for (const card of snapshot.cards) {
      void maybeOfferPlanPairing(card, agentDashboard);
    }
  });

  /* Phase 2: cost-cap warnings + auto-stop on hard breach. */
  agentDashboard.store.onBudgetBreach((ev) => {
    const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
    const teamLabel = ev.teamName ? `"${ev.teamName}" ` : "";
    if (ev.severity === "soft") {
      void vscode.window
        .showWarningMessage(
          `Run ${teamLabel}is projected to spend ${usd(ev.projectedCostUsd)} (budget ${usd(ev.budgetUsd)}). Stop now?`,
          "Stop now",
          "Keep running"
        )
        .then((pick) => {
          if (pick !== "Stop now" || !ev.runId) return;
          const runMod = require("./agents/runtime/runRegistry") as typeof import("./agents/runtime/runRegistry");
          const orchestrator = require("./agents/runtime/runOrchestrator") as typeof import("./agents/runtime/runOrchestrator");
          const run = runMod.getRun(ev.runId);
          if (run) orchestrator.abortRun(run);
        });
      return;
    }
    /* Hard breach: auto-stop internal runs without prompting. */
    if (!ev.runId) return;
    const runMod = require("./agents/runtime/runRegistry") as typeof import("./agents/runtime/runRegistry");
    const orchestrator = require("./agents/runtime/runOrchestrator") as typeof import("./agents/runtime/runOrchestrator");
    const run = runMod.getRun(ev.runId);
    if (run) {
      orchestrator.abortRun(run);
      vscode.window.showErrorMessage(
        `Auto-stopped ${teamLabel}— cost ${usd(ev.costUsd)} reached budget ${usd(ev.budgetUsd)}.`
      );
    }
  });

  const mcpHubActivity = new McpSkillsHubViewProvider(context, agentDashboard);
  const mcpHubSecondary = new McpSkillsHubViewProvider(context, agentDashboard);
  const refreshMcpHubs = (): void => {
    mcpHubActivity.refresh();
    mcpHubSecondary.refresh();
  };

  const kitProvider = new WorkspaceKitProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MCP_SKILLS_HUB_VIEW_ACTIVITY, mcpHubActivity),
    vscode.window.registerWebviewViewProvider(MCP_SKILLS_HUB_VIEW_SECONDARY, mcpHubSecondary),
    vscode.window.registerTreeDataProvider("cloudeCodeKitWorkspace", kitProvider)
  );

  const sub = (d: vscode.Disposable) => context.subscriptions.push(d);

  sub(registerThinkingMachineModeActivation(context));

  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.refreshMcpView", () => refreshMcpHubs())
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.refreshWorkspaceView", () =>
      kitProvider.refresh()
    )
  );

  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openWorkspaceMcp", async () => {
      try {
        await vscode.commands.executeCommand(MCP_CMD.openWorkspaceMcp);
      } catch {
        vscode.window.showErrorMessage(
          "Could not open workspace mcp.json. Use a recent VS Code build with MCP support."
        );
      }
    })
  );

  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openUserMcp", async () => {
      try {
        await vscode.commands.executeCommand(MCP_CMD.openUserMcp);
      } catch {
        vscode.window.showErrorMessage("Could not open user mcp.json.");
      }
    })
  );

  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.mcpListServers", async () => {
      try {
        await vscode.commands.executeCommand(MCP_CMD.listServer);
      } catch {
        vscode.window.showErrorMessage("MCP: List Servers not available in this VS Code build.");
      }
    })
  );

  sub(vscode.commands.registerCommand("CloudeCodeToolBox.mcpBrowseRegistry", mcpBrowseRegistry));
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.mcpAddServer", mcpAddServerNative));
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.portCursorMcp", portCursorMcp));
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.manualPortCursorMcpWithoutNpx",
      manualPortCursorMcpWithoutNpx
    )
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.syncCursorRules", syncCursorRules));
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.cursorRulesToClaudeWithoutNpx",
      cursorRulesToClaudeWithoutNpx
    )
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.initMemoryBank", initMemoryBank));
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.memoryBankWithoutNpx", memoryBankWithoutNpx));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.workspaceSetupWizard", workspaceSetupWizard)
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.openClaudeCodePanel", openClaudeCodePanel));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.toggleMcpDiscovery", toggleMcpDiscovery)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openInstructionsPicker", openInstructionsPicker)
  );

  sub(vscode.commands.registerCommand("CloudeCodeToolBox.appendCursorrules", appendCursorrules));
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd",
      runMergeCopilotInstructionsIntoClaudeMdCommand
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openClaudeUserSettingsJson", openClaudeUserSettingsJson)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.createCursorrulesTemplate", createCursorrulesTemplate)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openCursorClaudeReference", () =>
      openCursorClaudeReference(context)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openInlineChatCursorStyle", openInlineChatCursorStyle)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openComposerHub", () =>
      openComposerHubPanel(context)
    )
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.openSessionNotepad", openSessionNotepad));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.copySessionNotepad", copySessionNotepadToClipboard)
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.openClaudeCodeAccountDocs", openClaudeCodeAccountDocs));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openEnvSyncChecklist", showEnvSyncChecklist)
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.translateContextSelection",
      translateCursorContextInSelection
    )
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.buildContextPack", runBuildContextPackFlow));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.runThinkingMachinePriming", () =>
      void runThinkingMachinePriming(context)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.showMcpSkillsAwareness", () =>
      showMcpSkillsAwareness(context)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.showIntelligenceReadiness", showIntelligenceReadiness)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openIntelligenceSettings", openIntelligenceSettings)
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.openThinkingMachineModeSettings",
      openThinkingMachineModeSettings
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openOneClickSetupSettings", openOneClickSetupSettings)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.runOneClickSetup", () =>
      runOneClickSetup(context, refreshMcpHubs)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openIntelligenceToolboxRepos", (...args: unknown[]) => {
      const pref = typeof args[0] === "string" ? args[0] : undefined;
      void openIntelligenceToolboxRepos(pref);
    })
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.openIntelligenceRepoMcpPort", openIntelligenceRepoMcpPort)
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.openIntelligenceRepoMemoryBank",
      openIntelligenceRepoMemoryBank
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.openIntelligenceRepoRulesConverter",
      openIntelligenceRepoRulesConverter
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.migrateSkillsCursorToAgents",
      migrateSkillsCursorToAgents
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.migrateCopilotSkillsToAgents",
      migrateCopilotSkillsToAgents
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.revealSkillFoldersWithoutNpx",
      revealSkillFoldersWithoutNpx
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.revealCopilotSkillFoldersWithoutNpx",
      revealCopilotSkillFoldersWithoutNpx
    )
  );

  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.claudeToolboxConfigScan", runClaudeToolboxConfigScan)
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.appendNotepadToMemoryBank", appendNotepadToMemoryBank)
  );
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.createSkillStub", createSkillStubCommand));
  sub(vscode.commands.registerCommand("CloudeCodeToolBox.verificationChecklist", runVerificationChecklist));
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.applyBundledMcpRecipe", () =>
      applyBundledMcpRecipe(context)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.runFirstWorkspaceTestTask", runFirstWorkspaceTestTask)
  );

  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.openKitTarget",
      async (uriStr: string, isDirectory: boolean) => {
        const uri = vscode.Uri.parse(uriStr);
        try {
          if (isDirectory) {
            await vscode.commands.executeCommand("revealInExplorer", uri);
          } else {
            await vscode.window.showTextDocument(uri);
          }
        } catch {
          await vscode.window.showTextDocument(uri);
        }
      }
    )
  );

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    const w = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, ".vscode/mcp.json")
    );
    w.onDidChange(() => refreshMcpHubs());
    w.onDidCreate(() => refreshMcpHubs());
    w.onDidDelete(() => refreshMcpHubs());
    sub(w);

    const kitGlobs = [
      ".cursorrules",
      "memory-bank/**",
      "CLAUDE.md",
      ".claude/**",
      ".cursor/rules/**",
    ];
    for (const g of kitGlobs) {
      const kw = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, g)
      );
      kw.onDidChange(() => kitProvider.refresh());
      kw.onDidCreate(() => kitProvider.refresh());
      kw.onDidDelete(() => kitProvider.refresh());
      sub(kw);
    }
  }

  const cfg = vscode.workspace.getConfiguration();
  const userMcp = vscode.Uri.file(
    mcpPaths.userMcpJsonPath(cfg.get<boolean>("cloude-code-toolbox.useInsidersPaths") === true)
  );
  sub(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.fsPath === userMcp.fsPath) {
        refreshMcpHubs();
      }
    })
  );

  sub(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (affectsToolboxSetting(e, "useInsidersPaths")) {
        refreshMcpHubs();
      }
      if (affectsToolboxSetting(e, "intelligence.autoScanMcpSkillsOnWorkspaceOpen")) {
        refreshMcpHubs();
      }
      if (affectsToolboxSetting(e, "thinkingMachineMode.enabled")) {
        refreshMcpHubs();
      }
    })
  );

  registerMcpSkillsAutoScanOnWorkspaceOpen(context, async () => {
    await showMcpSkillsAwareness(context, { silentNotification: true });
    refreshMcpHubs();
  });

  /* Agent Teams commands. */
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentTeams.enable", async () => {
      try {
        await enableAgentTeams({
          scope: "user",
          installStarterPack: false,
        });
        refreshMcpHubs();
      } catch (e) {
        vscode.window.showErrorMessage(
          `Enable Agent Teams failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.agentTeams.installStarterPack",
      async () => {
        try {
          const folder = vscode.workspace.workspaceFolders?.[0];
          const result = await installSdlcStarterPack({
            selected: starterPackDefaultSelection(),
            scope: "user",
            homeDir: (await import("node:os")).homedir(),
            workspaceRoot: folder?.uri.fsPath,
          });
          const teamsBit = result.teamsWritten.length
            ? ` · ${result.teamsWritten.length} team(s) created`
            : "";
          vscode.window.showInformationMessage(
            `SDLC starter pack installed (${result.written.length} agents${teamsBit}) to ~/.claude/agents.`
          );
          refreshMcpHubs();
        } catch (e) {
          vscode.window.showErrorMessage(
            `Starter pack install failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentTeams.revealAgentsFolder", () => {
      revealAgentsFolder("user");
    })
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentTeams.refresh", () =>
      refreshMcpHubs()
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.agentTeams.installCommandsPack",
      async () => {
        try {
          const folder = vscode.workspace.workspaceFolders?.[0];
          const result = await installCommandsPack({
            selected: commandsPackDefaultSelection(),
            scope: "user",
            homeDir: (await import("node:os")).homedir(),
            workspaceRoot: folder?.uri.fsPath,
          });
          vscode.window.showInformationMessage(
            `Slash commands: ${result.written.length} installed (${result.skipped.length} already existed / foreign) at ${result.targetDir}. Type /<tab> in any claude session.`
          );
          refreshMcpHubs();
        } catch (e) {
          vscode.window.showErrorMessage(
            `Install slash commands failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.agentTeams.uninstallCommandsPack",
      async () => {
        try {
          const folder = vscode.workspace.workspaceFolders?.[0];
          const homeDir = (await import("node:os")).homedir();
          const user = await uninstallCommandsPack({ scope: "user", homeDir });
          const ws = folder
            ? await uninstallCommandsPack({
                scope: "workspace",
                homeDir,
                workspaceRoot: folder.uri.fsPath,
              })
            : { removed: [] as string[] };
          const total = user.removed.length + ws.removed.length;
          vscode.window.showInformationMessage(
            `Slash commands: removed ${total} file(s) (user: ${user.removed.length}${
              folder ? `, workspace: ${ws.removed.length}` : ""
            }).`
          );
          refreshMcpHubs();
        } catch (e) {
          vscode.window.showErrorMessage(
            `Uninstall slash commands failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );
  sub(
    vscode.commands.registerCommand(
      "CloudeCodeToolBox.agentTeams.listCommands",
      async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const homeDir = (await import("node:os")).homedir();
        const cmds = await listInstalledCommands(homeDir, folder?.uri.fsPath);
        if (!cmds.length) {
          vscode.window.showInformationMessage("No custom slash commands installed.");
          return;
        }
        const pick = await vscode.window.showQuickPick(
          cmds.map((c) => ({
            label: `/${c.id}`,
            description: c.ownedByToolbox ? "Toolbox" : "Foreign",
            detail: `${c.scope} · ${c.description ?? "(no description)"}`,
            path: c.filePath,
          })),
          { placeHolder: "Custom slash commands (select to open file)" }
        );
        if (pick) {
          void vscode.window.showTextDocument(vscode.Uri.file(pick.path));
        }
      }
    )
  );

  /* Agent Dashboard commands (Phase 1). */
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentDashboard.enable", async () => {
      await safeUpdateToolboxSetting("agentDashboard.enabled", true);
      try {
        await agentDashboard.start();
        const folder = vscode.workspace.workspaceFolders?.[0];
        const homeDir = (await import("node:os")).homedir();
        const teamsWritten = await writePresetTeamsIfEligible({
          scope: "user",
          homeDir,
          workspaceRoot: folder?.uri.fsPath,
        });
        let cmdsWritten = 0;
        try {
          const res = await installCommandsPack({
            selected: commandsPackDefaultSelection(),
            scope: "user",
            homeDir,
            workspaceRoot: folder?.uri.fsPath,
          });
          cmdsWritten = res.written.length;
        } catch {
          /* best-effort */
        }
        const extras: string[] = [];
        if (teamsWritten.length) extras.push(`${teamsWritten.length} team(s)`);
        if (cmdsWritten) extras.push(`${cmdsWritten} slash command(s)`);
        vscode.window.showInformationMessage(
          extras.length
            ? `Agent Dashboard enabled · ${extras.join(" · ")} created.`
            : "Agent Dashboard enabled."
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `Enable Agent Dashboard failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      refreshMcpHubs();
    })
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentDashboard.disable", async () => {
      await agentDashboard.stop().catch(() => undefined);
      await safeUpdateToolboxSetting("agentDashboard.enabled", false);
      refreshMcpHubs();
      vscode.window.showInformationMessage("Agent Dashboard disabled.");
    })
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentDashboard.status", async () => {
      const s = await agentDashboard.currentState();
      const parts = [
        `Agent Dashboard: ${s.running ? "running" : "stopped"}`,
        `port ${s.port ?? "n/a"}`,
        `${s.sessionsDiscovered} session(s)`,
      ];
      if (s.foreignHooks.length > 0) {
        parts.push(`foreign hook(s) detected: ${s.foreignHooks.length}`);
      }
      const msg = parts.join(" · ");
      if (s.foreignHooks.length > 0) {
        void vscode.window
          .showWarningMessage(msg + " — events may be double-processed.", "Show details")
          .then((pick) => {
            if (pick !== "Show details") return;
            const detail = s.foreignHooks.join("\n");
            vscode.window.showInformationMessage(
              `Foreign hooks in ~/.claude/settings.json:\n${detail}`,
              { modal: true }
            );
          });
      } else {
        vscode.window.showInformationMessage(msg);
      }
    })
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.agentDashboard.revealSettingsJson", async () => {
      const home = (await import("node:os")).homedir();
      const p = (await import("node:path")).join(home, ".claude", "settings.json");
      try {
        await vscode.window.showTextDocument(vscode.Uri.file(p));
      } catch {
        vscode.window.showWarningMessage(`Not found: ${p}`);
      }
    })
  );

  /* Phase 1.5 commands. */
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.planWithTeam", () =>
      planWithTeamCommand(agentDashboard)
    )
  );
  sub(
    vscode.commands.registerCommand("CloudeCodeToolBox.smartRouter", () =>
      smartRouterCommand(agentDashboard)
    )
  );

  /* React to settings changes that affect dashboard lifecycle. */
  sub(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("cloude-code-toolbox.agentDashboard.enabled")) {
        const isOn = vscode.workspace
          .getConfiguration()
          .get<boolean>("cloude-code-toolbox.agentDashboard.enabled", false);
        if (isOn && !agentDashboard.isRunning) {
          await agentDashboard.start().catch(() => undefined);
        } else if (!isOn && agentDashboard.isRunning) {
          await agentDashboard.stop().catch(() => undefined);
        }
        refreshMcpHubs();
      }
      if (
        e.affectsConfiguration("cloude-code-toolbox.agentDashboard.retainDoneCardsMs") ||
        e.affectsConfiguration("cloude-code-toolbox.agentDashboard.safetyAlerts")
      ) {
        const cfg2 = vscode.workspace.getConfiguration();
        agentDashboard.updateConfig({
          retainDoneCardsMs: cfg2.get<number>(
            "cloude-code-toolbox.agentDashboard.retainDoneCardsMs",
            60_000
          ),
          installSafetyGuard: cfg2.get<boolean>(
            "cloude-code-toolbox.agentDashboard.safetyAlerts",
            false
          ),
          safetyPatterns: cfg2.get<string[]>(
            "cloude-code-toolbox.agentDashboard.safetyPatterns",
            []
          ),
        });
      }
    })
  );
}

export function deactivate(): void {}
