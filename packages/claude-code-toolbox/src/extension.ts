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
import { affectsToolboxSetting, migrateLegacyToolboxSettings } from "./toolboxSettings";

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
  const mcpHubActivity = new McpSkillsHubViewProvider(context);
  const mcpHubSecondary = new McpSkillsHubViewProvider(context);
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
}

export function deactivate(): void {}
