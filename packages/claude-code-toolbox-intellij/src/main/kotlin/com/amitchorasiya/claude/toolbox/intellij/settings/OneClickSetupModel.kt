package com.amitchorasiya.claude.toolbox.intellij.settings

/**
 * Mirrors VS Code `cloude-code-toolbox.oneClickSetup.*` ([packages/cloude-code-toolbox/package.json]).
 * Stored under `oneClickSetup` in `.cloude/toolbox-settings.json`.
 */
data class OneClickSetupModel(
    var migrateFromCursor: Boolean = true,
    var migrateFromGitHubCopilot: Boolean = true,
    /** `off` | `workspace` | `user` | `both` */
    var migrateSkillsTarget: String = "off",
    /** `copy` | `move` */
    var migrateSkillsMode: String = "copy",
    /** `apply` | `dryRun` | `off` */
    var syncCursorRulesMode: String = "apply",
    var appendCursorrules: Boolean = true,
    /** `user` | `workspaceMerge` | `dry` | `skip` (legacy `workspaceOverwrite` normalized at runtime) */
    var portCursorMcp: String = "user",
    var mergeCopilotInstructionsIntoClaudeMd: Boolean = true,
    var migrateCopilotSkillsTarget: String = "workspace",
    var migrateCopilotSkillsMode: String = "copy",
    var copilotMcpReminderAfterOneClick: Boolean = true,
    /** `apply` | `dryRun` | `off` (legacy `applyForce` normalized at runtime) */
    var initMemoryBankMode: String = "apply",
    var initMemoryBankCursorRules: Boolean = true,
    /** `enableAutoScan` | `mergeClaudeMdOnce` | `leaveUnchanged` */
    var instructionMergeAfterOneClick: String = "enableAutoScan",
    var runAwarenessScan: Boolean = true,
    var runReadiness: Boolean = true,
    var runConfigScan: Boolean = true,
    var runFirstTestTask: Boolean = false,
)
