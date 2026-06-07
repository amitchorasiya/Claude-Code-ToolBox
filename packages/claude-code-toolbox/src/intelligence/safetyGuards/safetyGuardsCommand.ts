/**
 * VSCode commands for Safety Guards feature.
 */
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../../toolboxSettings";
import {
  type DestructiveCommandMode,
  type DomainWhitelistMode,
  DEFAULT_DESTRUCTIVE_PATTERNS,
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_BLOCKED_DOMAINS,
} from "./safetyGuardsCore";
import {
  renderDestructiveCommandHookScript,
  renderDomainWhitelistHookScript,
  DESTRUCTIVE_CMD_MARKER,
  DOMAIN_WHITELIST_MARKER,
} from "./hookScripts";
import * as path from "node:path";
import * as fs from "node:fs";

function getConfig() {
  const cfg = vscode.workspace.getConfiguration();
  return {
    enabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.enabled`, false),
    destructiveEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.destructiveCommands.enabled`, true),
    destructiveMode: cfg.get<DestructiveCommandMode>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.destructiveCommands.mode`, "block"),
    destructivePatterns: cfg.get<string[]>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.destructiveCommands.patterns`, DEFAULT_DESTRUCTIVE_PATTERNS),
    destructiveAllowOverrides: cfg.get<string[]>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.destructiveCommands.allowOverrides`, []),
    domainEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.domainWhitelist.enabled`, true),
    domainMode: cfg.get<DomainWhitelistMode>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.domainWhitelist.mode`, "allowlist"),
    domainAllowed: cfg.get<string[]>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.domainWhitelist.domains`, DEFAULT_ALLOWED_DOMAINS),
    domainBlocked: cfg.get<string[]>(`${TOOLBOX_SETTINGS_PREFIX}.safetyGuards.domainWhitelist.blockedDomains`, DEFAULT_BLOCKED_DOMAINS),
  };
}

export async function runSafetyGuardsEnable(): Promise<void> {
  const config = getConfig();
  await installHooks(config);
  void vscode.window.showInformationMessage(
    `Safety Guards activated — destructive commands: ${config.destructiveMode}, domain: ${config.domainMode} mode.`
  );
}

export async function runSafetyGuardsDisable(): Promise<void> {
  await uninstallHooks();
  void vscode.window.showInformationMessage("Safety Guards disabled. Hooks removed.");
}

export async function runSafetyGuardsStatus(): Promise<void> {
  const config = getConfig();
  const lines: string[] = [];
  lines.push("# Safety Guards Status");
  lines.push("");
  lines.push(`- **Enabled:** ${config.enabled ? "Yes" : "No"}`);
  lines.push("");
  lines.push("## Destructive Command Guard");
  lines.push(`- **Active:** ${config.destructiveEnabled ? "Yes" : "No"}`);
  lines.push(`- **Mode:** ${config.destructiveMode}`);
  lines.push(`- **Patterns:** ${config.destructivePatterns.length} rules`);
  lines.push(`- **Allow overrides:** ${config.destructiveAllowOverrides.length} exceptions`);
  lines.push("");
  lines.push("## Domain Whitelist");
  lines.push(`- **Active:** ${config.domainEnabled ? "Yes" : "No"}`);
  lines.push(`- **Mode:** ${config.domainMode}`);
  if (config.domainMode === "allowlist") {
    lines.push(`- **Allowed domains:** ${config.domainAllowed.length}`);
  } else {
    lines.push(`- **Blocked domains:** ${config.domainBlocked.length}`);
  }
  lines.push("");

  const hooksInstalled = checkHooksInstalled();
  lines.push(`- **Hooks installed:** ${hooksInstalled ? "Yes" : "No"}`);

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

export async function runOpenSafetyGuardsSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "cloude-code-toolbox.safetyGuards"
  );
}

export async function runEditDestructivePatterns(): Promise<void> {
  const config = getConfig();
  const content = [
    "# Destructive Command Patterns",
    "# One pattern per line. Lines starting with # are comments.",
    "# Save and close to update (changes apply to VS Code settings).",
    "",
    ...config.destructivePatterns,
  ].join("\n");

  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "plaintext",
  });
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage(
    "Edit patterns in VS Code Settings: cloude-code-toolbox.safetyGuards.destructiveCommands.patterns"
  );
}

export async function runEditDomainList(): Promise<void> {
  const config = getConfig();
  const domains = config.domainMode === "allowlist" ? config.domainAllowed : config.domainBlocked;
  const label = config.domainMode === "allowlist" ? "Allowed" : "Blocked";

  const content = [
    `# ${label} Domains (mode: ${config.domainMode})`,
    "# One domain per line. Use *.domain.com for wildcard subdomains.",
    "# Lines starting with # are comments.",
    "",
    ...domains,
  ].join("\n");

  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "plaintext",
  });
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage(
    `Edit domains in VS Code Settings: cloude-code-toolbox.safetyGuards.domainWhitelist.${config.domainMode === "allowlist" ? "domains" : "blockedDomains"}`
  );
}

async function installHooks(config: ReturnType<typeof getConfig>): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (!homeDir) return;

  const claudeDir = path.join(homeDir, ".claude");
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const settingsPath = path.join(claudeDir, "settings.json");
  let settings: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    settings = JSON.parse(raw);
  } catch { /* new file */ }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  if (!settings.hooks) settings.hooks = hooks;

  if (config.destructiveEnabled) {
    const scriptPath = path.join(claudeDir, "safety-guard-destructive.py");
    const script = renderDestructiveCommandHookScript(
      config.destructivePatterns,
      config.destructiveAllowOverrides,
      config.destructiveMode
    );
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    addHookEntry(hooks, "PreToolUse", `python3 "${scriptPath}"`, "safety-guard-destructive");
  }

  if (config.domainEnabled) {
    const scriptPath = path.join(claudeDir, "safety-guard-domain.py");
    const script = renderDomainWhitelistHookScript(
      config.domainMode,
      config.domainAllowed,
      config.domainBlocked
    );
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    addHookEntry(hooks, "PreToolUse", `python3 "${scriptPath}"`, "safety-guard-domain");
  }

  const tmpPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, settingsPath);
}

function addHookEntry(
  hooks: Record<string, unknown[]>,
  event: string,
  command: string,
  identifier: string
): void {
  if (!hooks[event]) hooks[event] = [];
  const arr = hooks[event] as Array<{ hooks?: Array<{ type: string; command: string }> }>;

  const idx = arr.findIndex((entry) =>
    entry.hooks?.some((h) => h.command.includes(identifier))
  );
  if (idx !== -1) {
    arr[idx] = { hooks: [{ type: "command", command }] };
    return;
  }

  arr.push({ hooks: [{ type: "command", command }] });
}

async function uninstallHooks(): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (!homeDir) return;

  const claudeDir = path.join(homeDir, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  const scriptFiles = ["safety-guard-destructive.py", "safety-guard-domain.py"];
  for (const f of scriptFiles) {
    const p = path.join(claudeDir, f);
    try { fs.unlinkSync(p); } catch { /* ok */ }
  }

  if (!fs.existsSync(settingsPath)) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch { return; }

  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks) return;

  for (const event of Object.keys(hooks)) {
    const arr = hooks[event] as Array<{ hooks?: Array<{ type: string; command: string }> }>;
    hooks[event] = arr.filter((entry) => {
      if (!entry.hooks) return true;
      return !entry.hooks.some((h) => h.command.includes("safety-guard-"));
    });
    if ((hooks[event] as unknown[]).length === 0) {
      delete hooks[event];
    }
  }

  const tmpPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, settingsPath);
}

function checkHooksInstalled(): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (!homeDir) return false;
  const claudeDir = path.join(homeDir, ".claude");
  return (
    fs.existsSync(path.join(claudeDir, "safety-guard-destructive.py")) ||
    fs.existsSync(path.join(claudeDir, "safety-guard-domain.py"))
  );
}
