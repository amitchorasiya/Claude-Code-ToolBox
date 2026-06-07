/**
 * VSCode commands for Token Optimization feature.
 */
import * as vscode from "vscode";
import { TOOLBOX_SETTINGS_PREFIX } from "../../toolboxSettings";
import {
  type VerbosityLevel,
  buildTokenOptimizationBlock,
  DEFAULT_PROJECT_MAP_EXTENSIONS,
} from "./tokenOptimizationCore";
import {
  detectLanguage,
  parseImportsExports,
  buildProjectMap,
  formatProjectMapMarkdown,
  type ProjectNode,
} from "./projectMapCore";
import { mergeTokenOptIntoClaudeMd, removeTokenOptFromClaudeMd } from "./mergeTokenOptIntoClaudeMd";
import { DEFAULT_CLAUDEIGNORE_CONTENT } from "./claudeIgnoreCore";
import { analyzeClaudeMd, formatAnalysisMarkdown } from "./claudeMdAnalyzerCore";
import { runGitCapture } from "../gitSpawn";
import {
  renderReadDedupHookScript,
  renderClaudeIgnoreHookScript,
  renderOutputCompressHookScript,
  READ_DEDUP_MARKER,
  CLAUDEIGNORE_MARKER,
  OUTPUT_COMPRESS_MARKER,
} from "./hookScripts";
import * as path from "node:path";
import * as fs from "node:fs";

function getFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0];
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration();
  return {
    enabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.enabled`, false),
    verbosityLevel: cfg.get<VerbosityLevel>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.verbosityLevel`, "concise"),
    projectMapEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.projectMap.enabled`, true),
    projectMapMaxFiles: cfg.get<number>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.projectMap.maxFiles`, 5000),
    projectMapExtensions: cfg.get<string[]>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.projectMap.extensions`, DEFAULT_PROJECT_MAP_EXTENSIONS),
    readDedupEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.readDeduplication.enabled`, true),
    readDedupWindowMs: cfg.get<number>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.readDeduplication.windowMs`, 300_000),
    outputCompressionEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.outputCompression.enabled`, true),
    outputCompressionMaxLines: cfg.get<number>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.outputCompression.maxLines`, 50),
    claudeIgnoreEnabled: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.claudeIgnore.enabled`, true),
    mergeInstructions: cfg.get<boolean>(`${TOOLBOX_SETTINGS_PREFIX}.tokenOptimization.mergeInstructionsIntoClaudeMd`, true),
  };
}

export async function runTokenOptimizationEnable(): Promise<void> {
  const folder = getFolder();
  if (!folder) {
    void vscode.window.showWarningMessage("Token Optimization: open a workspace first.");
    return;
  }

  const config = getConfig();

  if (config.mergeInstructions) {
    const block = buildTokenOptimizationBlock({
      verbosityLevel: config.verbosityLevel,
      projectMapEnabled: config.projectMapEnabled,
      claudeIgnoreEnabled: config.claudeIgnoreEnabled,
      readDedupEnabled: config.readDedupEnabled,
    });
    await mergeTokenOptIntoClaudeMd(folder, block);
  }

  if (config.projectMapEnabled) {
    await generateProjectMap(folder, config);
  }

  await installHooks(folder, config);

  void vscode.window.showInformationMessage(
    `Token Optimization activated (${config.verbosityLevel} mode). Project map + hooks installed.`
  );
}

export async function runTokenOptimizationDisable(): Promise<void> {
  const folder = getFolder();
  if (folder) {
    await removeTokenOptFromClaudeMd(folder);
  }

  await uninstallHooks();

  void vscode.window.showInformationMessage("Token Optimization disabled. Hooks removed, CLAUDE.md block removed.");
}

export async function runGenerateProjectMap(): Promise<void> {
  const folder = getFolder();
  if (!folder) {
    void vscode.window.showWarningMessage("Token Optimization: open a workspace first.");
    return;
  }
  const config = getConfig();
  await generateProjectMap(folder, config);
  void vscode.window.showInformationMessage("Project map generated: .claude/project-map.md");
}

export async function runAnalyzeClaudeMd(): Promise<void> {
  const folder = getFolder();
  if (!folder) {
    void vscode.window.showWarningMessage("Token Optimization: open a workspace first.");
    return;
  }

  const claudeMdUri = vscode.Uri.joinPath(folder.uri, "CLAUDE.md");
  let content = "";
  try {
    const doc = await vscode.workspace.fs.readFile(claudeMdUri);
    content = new TextDecoder().decode(doc);
  } catch {
    void vscode.window.showWarningMessage("No CLAUDE.md found in workspace root.");
    return;
  }

  const result = analyzeClaudeMd(content);
  const markdown = formatAnalysisMarkdown(result);

  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

export async function runCreateClaudeIgnore(): Promise<void> {
  const folder = getFolder();
  if (!folder) {
    void vscode.window.showWarningMessage("Token Optimization: open a workspace first.");
    return;
  }

  const ignoreUri = vscode.Uri.joinPath(folder.uri, ".claudeignore");
  try {
    await vscode.workspace.fs.stat(ignoreUri);
    void vscode.window.showInformationMessage(".claudeignore already exists.");
    const doc = await vscode.workspace.openTextDocument(ignoreUri);
    await vscode.window.showTextDocument(doc);
    return;
  } catch {
    /* does not exist — create it */
  }

  await vscode.workspace.fs.writeFile(ignoreUri, new TextEncoder().encode(DEFAULT_CLAUDEIGNORE_CONTENT));
  const doc = await vscode.workspace.openTextDocument(ignoreUri);
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage(".claudeignore created with default patterns.");
}

export async function runTokenOptimizationStatus(): Promise<void> {
  const config = getConfig();
  const folder = getFolder();

  const lines: string[] = [];
  lines.push("# Token Optimization Status");
  lines.push("");
  lines.push(`- **Enabled:** ${config.enabled ? "Yes" : "No"}`);
  lines.push(`- **Verbosity level:** ${config.verbosityLevel}`);
  lines.push(`- **Project map:** ${config.projectMapEnabled ? "On" : "Off"}`);
  lines.push(`- **Read deduplication:** ${config.readDedupEnabled ? "On" : "Off"} (window: ${config.readDedupWindowMs / 1000}s)`);
  lines.push(`- **Output compression:** ${config.outputCompressionEnabled ? "On" : "Off"} (max ${config.outputCompressionMaxLines} lines)`);
  lines.push(`- **.claudeignore:** ${config.claudeIgnoreEnabled ? "On" : "Off"}`);
  lines.push(`- **CLAUDE.md merge:** ${config.mergeInstructions ? "On" : "Off"}`);
  lines.push("");

  if (folder) {
    const mapUri = vscode.Uri.joinPath(folder.uri, ".claude", "project-map.md");
    try {
      const stat = await vscode.workspace.fs.stat(mapUri);
      lines.push(`- **Project map last generated:** ${new Date(stat.mtime).toLocaleString()}`);
    } catch {
      lines.push("- **Project map:** not yet generated");
    }

    const ignoreUri = vscode.Uri.joinPath(folder.uri, ".claudeignore");
    try {
      await vscode.workspace.fs.stat(ignoreUri);
      lines.push("- **.claudeignore:** present");
    } catch {
      lines.push("- **.claudeignore:** not present (run Create .claudeignore)");
    }
  }

  const hooksInstalled = checkHooksInstalled();
  lines.push(`- **Hooks installed:** ${hooksInstalled ? "Yes" : "No"}`);

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

export async function runOpenTokenOptSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "cloude-code-toolbox.tokenOptimization"
  );
}

async function generateProjectMap(
  folder: vscode.WorkspaceFolder,
  config: ReturnType<typeof getConfig>
): Promise<void> {
  const cwd = folder.uri.fsPath;
  const extensions = config.projectMapExtensions;
  const maxFiles = config.projectMapMaxFiles;

  const extArg = extensions.map((e) => `*${e}`).join("\n");
  const filesRaw = await runGitCapture(
    cwd,
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    maxFiles * 200,
    10_000
  );

  if (!filesRaw) {
    return;
  }

  const allFiles = filesRaw.split("\n").filter(Boolean);
  const filtered = allFiles
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .slice(0, maxFiles);

  const nodes: ProjectNode[] = [];
  for (const relPath of filtered) {
    const absPath = path.join(cwd, relPath);
    const language = detectLanguage(relPath);
    if (language === "unknown") continue;

    let content: string;
    try {
      content = fs.readFileSync(absPath, "utf8");
    } catch {
      continue;
    }

    const lineCount = content.split("\n").length;
    const { imports, exports } = parseImportsExports(content, language);
    nodes.push({ relativePath: relPath, language, exports, imports, lineCount });
  }

  const projectMap = buildProjectMap(nodes);
  const markdown = formatProjectMapMarkdown(projectMap);

  const claudeDir = vscode.Uri.joinPath(folder.uri, ".claude");
  try {
    await vscode.workspace.fs.stat(claudeDir);
  } catch {
    await vscode.workspace.fs.createDirectory(claudeDir);
  }

  const mapUri = vscode.Uri.joinPath(claudeDir, "project-map.md");
  await vscode.workspace.fs.writeFile(mapUri, new TextEncoder().encode(markdown));
}

async function installHooks(
  folder: vscode.WorkspaceFolder,
  config: ReturnType<typeof getConfig>
): Promise<void> {
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
  } catch {
    /* new file */
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  if (!settings.hooks) settings.hooks = hooks;

  if (config.readDedupEnabled) {
    const scriptPath = path.join(claudeDir, "token-opt-read-dedup.py");
    const script = renderReadDedupHookScript(config.readDedupWindowMs);
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    addHookEntry(hooks, "PreToolUse", `python3 "${scriptPath}"`, READ_DEDUP_MARKER);
  }

  if (config.claudeIgnoreEnabled) {
    const scriptPath = path.join(claudeDir, "token-opt-claudeignore.py");
    const script = renderClaudeIgnoreHookScript(folder.uri.fsPath);
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    addHookEntry(hooks, "PreToolUse", `python3 "${scriptPath}"`, CLAUDEIGNORE_MARKER);
  }

  if (config.outputCompressionEnabled) {
    const scriptPath = path.join(claudeDir, "token-opt-output-compress.py");
    const script = renderOutputCompressHookScript(config.outputCompressionMaxLines);
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    addHookEntry(hooks, "PostToolUse", `python3 "${scriptPath}"`, OUTPUT_COMPRESS_MARKER);
  }

  const tmpPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, settingsPath);
}

function addHookEntry(
  hooks: Record<string, unknown[]>,
  event: string,
  command: string,
  marker: string
): void {
  if (!hooks[event]) hooks[event] = [];
  const arr = hooks[event] as Array<{ hooks?: Array<{ type: string; command: string }> }>;

  const alreadyInstalled = arr.some((entry) =>
    entry.hooks?.some((h) => h.command.includes(marker.split(" ")[1]))
  );
  if (alreadyInstalled) return;

  arr.push({
    hooks: [{ type: "command", command }],
  });
}

async function uninstallHooks(): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (!homeDir) return;

  const claudeDir = path.join(homeDir, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  const scriptFiles = [
    "token-opt-read-dedup.py",
    "token-opt-claudeignore.py",
    "token-opt-output-compress.py",
  ];
  for (const f of scriptFiles) {
    const p = path.join(claudeDir, f);
    try { fs.unlinkSync(p); } catch { /* ok */ }
  }

  if (!fs.existsSync(settingsPath)) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return;
  }

  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks) return;

  for (const event of Object.keys(hooks)) {
    const arr = hooks[event] as Array<{ hooks?: Array<{ type: string; command: string }> }>;
    hooks[event] = arr.filter((entry) => {
      if (!entry.hooks) return true;
      return !entry.hooks.some((h) => h.command.includes("token-opt-"));
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
    fs.existsSync(path.join(claudeDir, "token-opt-read-dedup.py")) ||
    fs.existsSync(path.join(claudeDir, "token-opt-claudeignore.py")) ||
    fs.existsSync(path.join(claudeDir, "token-opt-output-compress.py"))
  );
}
