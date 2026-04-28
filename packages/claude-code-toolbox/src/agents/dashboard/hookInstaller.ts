/**
 * Atomic `~/.claude/settings.json` editor + Python helper script emitter.
 *
 * Install flow: write `agent-dock-hook.py` (marker comment on line 1), merge
 * hook entries into `settings.hooks.<Event>`, deduplicate, atomic rename.
 * Uninstall flow: remove only entries whose command contains our script path;
 * delete the helper file. Never silently mutate malformed user settings.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteText } from "../atomicFile";

export type HookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "SubagentStop"
  | "PermissionRequest";

export const DEFAULT_HOOK_EVENTS: HookEventName[] = [
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "PermissionRequest",
];

export const HOOK_SCRIPT_MARKER = "# cloude-code-toolbox-agent-dashboard v1";
export const HOOK_SCRIPT_BASENAME = "agent-dock-hook.py";
export const SAFETY_HOOK_MARKER = "# cloude-code-toolbox-safety-guard v1";
export const SAFETY_HOOK_BASENAME = "agent-safety-guard.py";

export type HookInstallOptions = {
  homeDir?: string;
  port: number;
  events?: HookEventName[];
  /** Phase 1.6: additionally install the PreToolUse safety guard helper. */
  installSafetyGuard?: boolean;
  /** Patterns the safety guard flags (regex strings). */
  safetyPatterns?: string[];
};

export type HookInstallResult = {
  scriptPath: string;
  settingsPath: string;
  eventsInstalled: HookEventName[];
  safetyGuardInstalled: boolean;
};

export type HookInstallerStatus = {
  installed: boolean;
  scriptPath: string;
  safetyScriptPath: string;
  safetyGuardInstalled: boolean;
  settingsPath: string;
  port: number | null;
  events: HookEventName[];
};

export class HookInstallerError extends Error {}

export function defaultHomeDir(): string {
  return os.homedir();
}

export function pythonBinary(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function settingsPathFor(homeDir: string): string {
  return path.join(homeDir, ".claude", "settings.json");
}

function scriptPathFor(homeDir: string): string {
  return path.join(homeDir, ".claude", HOOK_SCRIPT_BASENAME);
}

function safetyScriptPathFor(homeDir: string): string {
  return path.join(homeDir, ".claude", SAFETY_HOOK_BASENAME);
}

function shellQuote(value: string): string {
  if (process.platform === "win32") {
    /* Windows command tokenization: wrap in double quotes, escape embedded quotes. */
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildCommand(scriptPath: string): string {
  return `${pythonBinary()} ${shellQuote(scriptPath)}`;
}

export function renderHookScript(port: number): string {
  /* Standalone Python 3 script; no third-party deps. POSTs JSON to our server
   * with a short timeout, silently ignoring any error so Claude is never blocked. */
  return [
    "#!/usr/bin/env python3",
    HOOK_SCRIPT_MARKER,
    "# Posts Claude Code hook payload to the Agent Dashboard HTTP listener.",
    "# Managed by the Claude Code ToolBox VS Code extension — uninstall via the",
    "# Teams tab to remove this file and the associated settings.json entries.",
    "import json",
    "import os",
    "import sys",
    "import urllib.request",
    "",
    `PORT = ${port}`,
    "URL = f'http://127.0.0.1:{PORT}/hook'",
    "",
    "def main() -> None:",
    "    try:",
    "        raw = sys.stdin.read()",
    "        data = json.loads(raw) if raw.strip() else {}",
    "    except Exception:",
    "        data = {}",
    "    if not isinstance(data, dict):",
    "        data = {'payload': data}",
    "    data.setdefault('cwd', os.getcwd())",
    "    body = json.dumps(data).encode('utf-8')",
    "    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'application/json'})",
    "    try:",
    "        urllib.request.urlopen(req, timeout=1).read()",
    "    except Exception:",
    "        pass",
    "    # Always exit 0 so Claude never treats the hook as blocking.",
    "    sys.exit(0)",
    "",
    "if __name__ == '__main__':",
    "    main()",
    "",
  ].join("\n");
}

export function renderSafetyHookScript(port: number, patterns: string[]): string {
  const patternsJson = JSON.stringify(patterns.length ? patterns : [
    "\\brm\\s+-rf\\b",
    "\\brm\\s+-fr\\b",
    "\\.env(?:$|[^a-zA-Z0-9])",
    "\\bcurl\\b.*\\|\\s*sh\\b",
  ]);
  return [
    "#!/usr/bin/env python3",
    SAFETY_HOOK_MARKER,
    "# PreToolUse safety guard companion to the Agent Dashboard hook.",
    "# Detects risky patterns in tool input and forwards a safetyAlert event.",
    "# Never blocks Claude Code (always exits 0) — warnings surface in the dashboard.",
    "import json",
    "import os",
    "import re",
    "import sys",
    "import urllib.request",
    "",
    `PORT = ${port}`,
    "URL = f'http://127.0.0.1:{PORT}/hook'",
    `PATTERNS = ${patternsJson}`,
    "",
    "def risky_text(value):",
    "    if isinstance(value, str):",
    "        for p in PATTERNS:",
    "            try:",
    "                if re.search(p, value):",
    "                    return p",
    "            except Exception:",
    "                pass",
    "    return None",
    "",
    "def main() -> None:",
    "    try:",
    "        raw = sys.stdin.read()",
    "        data = json.loads(raw) if raw.strip() else {}",
    "    except Exception:",
    "        data = {}",
    "    if not isinstance(data, dict):",
    "        data = {'payload': data}",
    "    data.setdefault('cwd', os.getcwd())",
    "    tool_input = data.get('tool_input')",
    "    target_values = []",
    "    if isinstance(tool_input, dict):",
    "        for k in ('command','file_path','path','pattern','query','url'):",
    "            v = tool_input.get(k)",
    "            if isinstance(v, str):",
    "                target_values.append(v)",
    "    matched = None",
    "    for v in target_values:",
    "        m = risky_text(v)",
    "        if m:",
    "            matched = (m, v)",
    "            break",
    "    if matched:",
    "        body = json.dumps({",
    "            'hook_event_name': 'SafetyAlert',",
    "            'session_id': data.get('session_id'),",
    "            'tool_name': data.get('tool_name'),",
    "            'tool_input': tool_input,",
    "            'cwd': data.get('cwd'),",
    "            'pattern': matched[0],",
    "            'match_value': matched[1][:280],",
    "        }).encode('utf-8')",
    "        req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'application/json'})",
    "        try:",
    "            urllib.request.urlopen(req, timeout=1).read()",
    "        except Exception:",
    "            pass",
    "    sys.exit(0)",
    "",
    "if __name__ == '__main__':",
    "    main()",
    "",
  ].join("\n");
}

type HookEntry = { hooks: Array<{ type: string; command: string }> };

function readSettings(settingsPath: string): UnknownRecord {
  let text: string;
  try {
    text = fs.readFileSync(settingsPath, "utf8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return {};
    throw new HookInstallerError(`Cannot read ${settingsPath}: ${err.message ?? String(e)}`);
  }
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HookInstallerError(`${settingsPath} is not a JSON object; refusing to edit.`);
    }
    return parsed as UnknownRecord;
  } catch (e) {
    if (e instanceof HookInstallerError) throw e;
    throw new HookInstallerError(
      `${settingsPath} is not valid JSON — fix or remove it, then try again. (${
        e instanceof Error ? e.message : String(e)
      })`
    );
  }
}

type UnknownRecord = Record<string, unknown>;

async function atomicWriteJson(filePath: string, obj: UnknownRecord): Promise<void> {
  await atomicWriteText(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

function normalizeHooksField(raw: unknown): Record<string, HookEntry[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, HookEntry[]> = {};
  for (const [event, value] of Object.entries(raw as UnknownRecord)) {
    if (Array.isArray(value)) {
      const valid: HookEntry[] = [];
      for (const item of value) {
        if (
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Array.isArray((item as UnknownRecord).hooks)
        ) {
          const hooks = (item as { hooks: Array<{ type?: unknown; command?: unknown }> }).hooks
            .filter((h) => h && typeof h === "object")
            .map((h) => ({
              type: typeof h.type === "string" ? h.type : "command",
              command: typeof h.command === "string" ? h.command : "",
            }))
            .filter((h) => h.command);
          if (hooks.length) valid.push({ hooks });
        }
      }
      out[event] = valid;
    }
  }
  return out;
}

function mergeHookEntry(
  existing: HookEntry[],
  command: string
): { next: HookEntry[]; changed: boolean } {
  for (const entry of existing) {
    if (entry.hooks.some((h) => h.command === command)) {
      return { next: existing, changed: false };
    }
  }
  const next: HookEntry[] = [
    ...existing,
    { hooks: [{ type: "command", command }] },
  ];
  return { next, changed: true };
}

export async function installHook(options: HookInstallOptions): Promise<HookInstallResult> {
  const homeDir = options.homeDir ?? defaultHomeDir();
  const events = options.events ?? DEFAULT_HOOK_EVENTS;
  const scriptPath = scriptPathFor(homeDir);
  const settingsPath = settingsPathFor(homeDir);
  await atomicWriteText(scriptPath, renderHookScript(options.port), 0o755);
  let safetyGuardInstalled = false;
  let safetyCommand = "";
  if (options.installSafetyGuard) {
    const safetyPath = safetyScriptPathFor(homeDir);
    await atomicWriteText(
      safetyPath,
      renderSafetyHookScript(options.port, options.safetyPatterns ?? []),
      0o755
    );
    safetyCommand = buildCommand(safetyPath);
    safetyGuardInstalled = true;
  }
  const settings = readSettings(settingsPath);
  const hooksField = normalizeHooksField(settings.hooks);
  const command = buildCommand(scriptPath);
  for (const event of events) {
    const existing = hooksField[event] ?? [];
    const { next } = mergeHookEntry(existing, command);
    hooksField[event] = next;
  }
  if (safetyGuardInstalled) {
    const preEntries = hooksField.PreToolUse ?? [];
    const { next } = mergeHookEntry(preEntries, safetyCommand);
    hooksField.PreToolUse = next;
  }
  const nextSettings: UnknownRecord = { ...settings, hooks: hooksField };
  await atomicWriteJson(settingsPath, nextSettings);
  return {
    scriptPath,
    settingsPath,
    eventsInstalled: [...events],
    safetyGuardInstalled,
  };
}

export async function uninstallHook(
  homeDir: string = defaultHomeDir()
): Promise<{ removedEvents: HookEventName[]; safetyRemoved: boolean; settingsPath: string }> {
  const scriptPath = scriptPathFor(homeDir);
  const safetyPath = safetyScriptPathFor(homeDir);
  const settingsPath = settingsPathFor(homeDir);
  let settings: UnknownRecord;
  try {
    settings = readSettings(settingsPath);
  } catch {
    return { removedEvents: [], safetyRemoved: false, settingsPath };
  }
  const hooksField = normalizeHooksField(settings.hooks);
  const removed: HookEventName[] = [];
  const ourMarker = path.basename(scriptPath);
  const ourSafetyMarker = path.basename(safetyPath);
  let safetyRemoved = false;
  for (const [event, entries] of Object.entries(hooksField)) {
    const filtered: HookEntry[] = [];
    let mutated = false;
    let safetyMutated = false;
    for (const entry of entries) {
      const hooks = entry.hooks.filter((h) => {
        if (h.command.includes(ourMarker)) {
          mutated = true;
          return false;
        }
        if (h.command.includes(ourSafetyMarker)) {
          safetyMutated = true;
          return false;
        }
        return true;
      });
      if (hooks.length) filtered.push({ hooks });
      else if (entry.hooks.length) mutated = mutated || entry.hooks.length > 0;
    }
    if (mutated || safetyMutated) {
      if (mutated) removed.push(event as HookEventName);
      if (safetyMutated) safetyRemoved = true;
      hooksField[event] = filtered;
    }
  }
  /* Drop empty arrays / empty object. */
  for (const [event, entries] of Object.entries(hooksField)) {
    if (!entries.length) delete hooksField[event];
  }
  const nextSettings: UnknownRecord = { ...settings };
  if (Object.keys(hooksField).length) nextSettings.hooks = hooksField;
  else delete nextSettings.hooks;
  await atomicWriteJson(settingsPath, nextSettings);
  try {
    await fsp.unlink(scriptPath);
  } catch {
    /* already gone */
  }
  try {
    await fsp.unlink(safetyPath);
  } catch {
    /* already gone */
  }
  return { removedEvents: removed, safetyRemoved, settingsPath };
}

export async function rewritePortInScript(
  port: number,
  homeDir: string = defaultHomeDir(),
  installSafetyGuard = false,
  safetyPatterns: string[] = []
): Promise<void> {
  const scriptPath = scriptPathFor(homeDir);
  await atomicWriteText(scriptPath, renderHookScript(port), 0o755);
  if (installSafetyGuard) {
    const safetyPath = safetyScriptPathFor(homeDir);
    await atomicWriteText(safetyPath, renderSafetyHookScript(port, safetyPatterns), 0o755);
  }
}

export async function hookStatus(
  homeDir: string = defaultHomeDir()
): Promise<HookInstallerStatus> {
  const scriptPath = scriptPathFor(homeDir);
  const safetyScriptPath = safetyScriptPathFor(homeDir);
  const settingsPath = settingsPathFor(homeDir);
  let installed = false;
  let safetyGuardInstalled = false;
  let port: number | null = null;
  try {
    const text = await fsp.readFile(scriptPath, "utf8");
    installed = text.includes(HOOK_SCRIPT_MARKER);
    const m = text.match(/PORT\s*=\s*(\d+)/);
    if (m) port = Number(m[1]);
  } catch {
    installed = false;
  }
  try {
    const text = await fsp.readFile(safetyScriptPath, "utf8");
    safetyGuardInstalled = text.includes(SAFETY_HOOK_MARKER);
  } catch {
    safetyGuardInstalled = false;
  }
  let events: HookEventName[] = [];
  try {
    const settings = readSettings(settingsPath);
    const hooksField = normalizeHooksField(settings.hooks);
    const ourMarker = path.basename(scriptPath);
    events = Object.entries(hooksField)
      .filter(([_, entries]) => entries.some((e) => e.hooks.some((h) => h.command.includes(ourMarker))))
      .map(([name]) => name as HookEventName);
  } catch {
    /* leave events empty */
  }
  return {
    installed,
    scriptPath,
    safetyScriptPath,
    safetyGuardInstalled,
    settingsPath,
    port,
    events,
  };
}

/**
 * Detect foreign agent-dock installations that would double-fire hook events.
 *
 * Looks at each hook command string and returns:
 *   - foreign script paths that share the same basename as ours (collision),
 *   - plus any command pointing at a `.py` outside our managed script path
 *     that looks like an agent-dock clone (filename contains `agent-dock`,
 *     `claude-dock`, `agent_dock`, etc.).
 */
export async function detectForeignHooks(
  homeDir: string = defaultHomeDir()
): Promise<string[]> {
  const settingsPath = settingsPathFor(homeDir);
  const ourScript = scriptPathFor(homeDir);
  const ourSafety = safetyScriptPathFor(homeDir);
  const foreign = new Set<string>();
  let settings: UnknownRecord;
  try {
    settings = readSettings(settingsPath);
  } catch {
    return [];
  }
  const hooks = normalizeHooksField(settings.hooks);
  const suspectRe = /agent[-_]?(dock|dash|octopus|dashboard)/i;
  for (const entries of Object.values(hooks)) {
    for (const entry of entries) {
      for (const h of entry.hooks) {
        const cmd = h.command;
        if (!cmd) continue;
        if (cmd.includes(ourScript) || cmd.includes(ourSafety)) continue;
        if (suspectRe.test(cmd)) foreign.add(cmd);
      }
    }
  }
  return Array.from(foreign);
}
