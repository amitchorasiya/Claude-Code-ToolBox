/**
 * SDLC slash-command bridge.
 *
 * Writes Claude Code custom slash commands (`.md` files) under
 * `~/.claude/commands/` or `<workspace>/.claude/commands/` so users can type
 * `/debate-team`, `/plan-team`, `/review-team` etc. inside any `claude`
 * session and dispatch the matching Toolbox agents via the native Task tool.
 *
 * Each generated file starts with a marker comment (`<!-- claude-code-toolbox
 * v1 -->`) so `uninstallCommandsPack` can remove only ours.
 *
 * Cross-platform: paths use `path.join` + `os.homedir()` (Claude Code resolves
 * `~` to `%USERPROFILE%` on Windows automatically). Atomic writes via the
 * shared `atomicFile.ts` helper.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { atomicWriteText } from "./atomicFile";

export const COMMANDS_PACK_MARKER = "<!-- claude-code-toolbox v1 -->";

export type CommandPackEntry = {
  /** Slash-command name (also the filename without `.md`). Must be lowercase + hyphens. */
  id: string;
  description: string;
  /** Short placeholder hint shown by Claude Code next to the argument cursor. */
  argumentHint: string;
  /** Agents this command's body dispatches via Task tool, in order. */
  requires: string[];
  /** Rendered markdown body — minus the frontmatter. */
  body: string;
  /** If false, only install when the user explicitly picks it. */
  defaultSelected: boolean;
};

/**
 * Six SDLC-oriented commands that bridge Claude Code's native chat to our
 * agents via Task-tool dispatch. Names deliberately avoid reserved built-ins
 * (`/plan`, `/compact`, `/help`, `/loop`).
 */
export const SDLC_COMMANDS: readonly CommandPackEntry[] = [
  {
    id: "plan-team",
    description: "Plan-phase team (product-manager → architect) produces a design recommendation.",
    argumentHint: "<what should the team plan?>",
    requires: ["product-manager", "architect"],
    defaultSelected: true,
    body: [
      "You have access to these custom subagents. Use the **Task** tool to dispatch work to them, one at a time, in this order:",
      "",
      "1. `product-manager` — restate the user's intent and extract 3-7 testable acceptance criteria.",
      "2. `architect` — design the approach, flag trade-offs, list alternatives rejected.",
      "",
      "After both have replied, synthesize:",
      "- A short **Plan** section (numbered steps, each one-line).",
      "- Any **Open questions** the architect left unresolved.",
      "- Your recommended next action: `APPROVE / REVISE`.",
      "",
      "User's request:",
      "$ARGUMENTS",
      "",
    ].join("\n"),
  },
  {
    id: "debate-team",
    description: "Multi-agent debate: architect vs security-reviewer with product-manager context. Final verdict included.",
    argumentHint: "<topic or design decision>",
    requires: ["product-manager", "architect", "security-reviewer"],
    defaultSelected: true,
    body: [
      "Run a short structured debate using the **Task** tool to dispatch these subagents in order:",
      "",
      "1. `product-manager` — frame the question. State the user's intent and why it matters.",
      "2. `architect` — argue the recommended approach and reason about scalability / maintainability.",
      "3. `security-reviewer` — push back on the architect's answer with OWASP / data-handling / auth concerns.",
      "4. `architect` — one-turn rebuttal addressing the security points.",
      "",
      "After all four turns, wrap the final verdict in `<decision>…</decision>` tags. Include:",
      "- Strongest point from each side.",
      "- Your verdict (`APPROVE` / `REVISE`) + rationale.",
      "- One concrete next step.",
      "",
      "Topic:",
      "$ARGUMENTS",
      "",
    ].join("\n"),
  },
  {
    id: "review-team",
    description: "Review the pending diff with code-reviewer then security-reviewer. Produces a blocking/nit grouped report.",
    argumentHint: "<optional focus area; leave empty for full diff>",
    requires: ["code-reviewer", "security-reviewer"],
    defaultSelected: true,
    body: [
      "Run `git diff` first to capture the pending diff. Then use the **Task** tool to dispatch subagents sequentially:",
      "",
      "1. `code-reviewer` — review for correctness, readability, and matching existing patterns. Group findings by severity.",
      "2. `security-reviewer` — second pass for OWASP, secrets, injection, deserialization risks.",
      "",
      "Combine their findings into a single report with:",
      "- `blocking:` (must fix before merge)",
      "- `high:` / `medium:` / `low:`",
      "- `nit:` (optional)",
      "",
      "End with one of `APPROVE` / `REQUEST_CHANGES` and a one-line justification.",
      "",
      "Optional focus area: $ARGUMENTS",
      "",
    ].join("\n"),
  },
  {
    id: "security-team",
    description: "Threat-model the user's change with security-reviewer only. OWASP-oriented.",
    argumentHint: "<description of the change>",
    requires: ["security-reviewer"],
    defaultSelected: true,
    body: [
      "Dispatch the `security-reviewer` subagent via the **Task** tool with the user's description below. Ask it to:",
      "",
      "1. Enumerate OWASP-relevant risks (authn/authz, injection, SSRF, secrets, deserialization, PII).",
      "2. Propose one concrete mitigation per risk.",
      "3. Flag anything that needs a compliance review (GDPR / HIPAA / SOC2).",
      "",
      "Return the report as-is; do not summarise away specific findings.",
      "",
      "Change description:",
      "$ARGUMENTS",
      "",
    ].join("\n"),
  },
  {
    id: "refactor-team",
    description: "Refactor coordinator: backend-dev + frontend-dev + qa-test-engineer with a code-reviewer wrap-up.",
    argumentHint: "<what to refactor and why>",
    requires: ["backend-dev", "frontend-dev", "qa-test-engineer", "code-reviewer"],
    defaultSelected: false,
    body: [
      "Coordinate a refactor across surface areas using the **Task** tool to dispatch subagents in order:",
      "",
      "1. `backend-dev` — list server-side files / types to change, propose the smallest reviewable edit sequence.",
      "2. `frontend-dev` — same, but for UI/client code.",
      "3. `qa-test-engineer` — describe the tests that will catch regressions; specify the command to run them.",
      "4. `code-reviewer` — sanity-check the whole plan for scope creep.",
      "",
      "Output:",
      "- Ordered edit plan (one line each).",
      "- Test command.",
      "- Rollback plan if any step fails.",
      "",
      "Refactor target:",
      "$ARGUMENTS",
      "",
    ].join("\n"),
  },
  {
    id: "spec-team",
    description: "Turn a rough idea into a spec: product-manager writes PRD, architect adds technical addendum.",
    argumentHint: "<feature idea or problem statement>",
    requires: ["product-manager", "architect"],
    defaultSelected: false,
    body: [
      "Build a spec using the **Task** tool to dispatch these subagents in order:",
      "",
      "1. `product-manager` — write a concise PRD with sections: problem, users, success metrics, 3-7 acceptance criteria, out-of-scope.",
      "2. `architect` — write a *Technical addendum* below the PRD with: integration points, data model changes, failure modes, observability, alternatives considered.",
      "",
      "Return the combined document as markdown. Do not add commentary outside the PRD + addendum.",
      "",
      "Idea:",
      "$ARGUMENTS",
      "",
    ].join("\n"),
  },
];

export type InstallCommandsPackOptions = {
  selected: readonly string[];
  scope: "user" | "workspace";
  homeDir: string;
  workspaceRoot?: string;
  overwrite?: boolean;
};

export type InstallCommandsPackResult = {
  written: string[];
  skipped: string[];
  targetDir: string;
};

export function commandsDirForScope(
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string
): string | undefined {
  if (scope === "user") {
    return path.join(homeDir, ".claude", "commands");
  }
  if (!workspaceRoot) return undefined;
  return path.join(workspaceRoot, ".claude", "commands");
}

function renderCommandMarkdown(entry: CommandPackEntry): string {
  /* YAML is intentionally minimal — Claude Code accepts only `description`,
   * `argument-hint`, `model`, `allowed-tools` reliably. We emit just the
   * first two to avoid tying ourselves to a specific model. */
  const escape = (s: string): string => {
    const needsQuote = /[:\-?#*&!|>'"%@`,\[\]{}\n]/.test(s) || /^\s|\s$/.test(s);
    if (!needsQuote) return s;
    return JSON.stringify(s); // JSON == valid YAML double-quoted scalar
  };
  return [
    "---",
    `description: ${escape(entry.description)}`,
    `argument-hint: ${escape(entry.argumentHint)}`,
    "---",
    COMMANDS_PACK_MARKER,
    "",
    entry.body.trim(),
    "",
  ].join("\n");
}

/** IDs pre-checked by default in the installer UI. */
export function commandsPackDefaultSelection(): string[] {
  return SDLC_COMMANDS.filter((c) => c.defaultSelected).map((c) => c.id);
}

/**
 * Install selected SDLC slash commands. Idempotent: existing files whose first
 * non-frontmatter line is our marker are replaced only when `overwrite` is
 * true; foreign files at the same name are never touched.
 */
export async function installCommandsPack(
  opts: InstallCommandsPackOptions
): Promise<InstallCommandsPackResult> {
  const dir = commandsDirForScope(opts.scope, opts.homeDir, opts.workspaceRoot);
  if (!dir) {
    throw new Error("Open a workspace folder to install workspace-scope commands.");
  }
  await fs.mkdir(dir, { recursive: true });
  const selectedSet = new Set(opts.selected);
  const written: string[] = [];
  const skipped: string[] = [];
  for (const cmd of SDLC_COMMANDS) {
    if (!selectedSet.has(cmd.id)) continue;
    const target = path.join(dir, `${cmd.id}.md`);
    let existing: string | undefined;
    try {
      existing = await fs.readFile(target, "utf8");
    } catch {
      /* not present */
    }
    if (existing && !opts.overwrite) {
      if (!existing.includes(COMMANDS_PACK_MARKER)) {
        /* Foreign file — never touch. */
        skipped.push(cmd.id);
        continue;
      }
      /* Ours but overwrite=false → keep as-is. */
      skipped.push(cmd.id);
      continue;
    }
    if (existing && opts.overwrite && !existing.includes(COMMANDS_PACK_MARKER)) {
      /* Even with overwrite, refuse to clobber a foreign file. */
      skipped.push(cmd.id);
      continue;
    }
    await atomicWriteText(target, renderCommandMarkdown(cmd));
    written.push(cmd.id);
  }
  return { written, skipped, targetDir: dir };
}

export type UninstallCommandsPackOptions = {
  scope: "user" | "workspace";
  homeDir: string;
  workspaceRoot?: string;
};

export type UninstallCommandsPackResult = {
  removed: string[];
  targetDir: string | undefined;
};

/** Delete only command files whose body contains our marker. */
export async function uninstallCommandsPack(
  opts: UninstallCommandsPackOptions
): Promise<UninstallCommandsPackResult> {
  const dir = commandsDirForScope(opts.scope, opts.homeDir, opts.workspaceRoot);
  const removed: string[] = [];
  if (!dir) return { removed, targetDir: undefined };
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { removed, targetDir: dir };
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
    const p = path.join(dir, entry.name);
    let text: string;
    try {
      text = await fs.readFile(p, "utf8");
    } catch {
      continue;
    }
    if (!text.includes(COMMANDS_PACK_MARKER)) continue;
    try {
      await fs.unlink(p);
      removed.push(entry.name.replace(/\.md$/i, ""));
    } catch {
      /* ignore */
    }
  }
  return { removed, targetDir: dir };
}

export type InstalledCommand = {
  id: string;
  filePath: string;
  scope: "user" | "workspace";
  description?: string;
  argumentHint?: string;
  /** True when the file contains our marker — i.e. we own it. */
  ownedByToolbox: boolean;
};

/**
 * Enumerate existing slash commands in both scopes so the UI can show
 * "Installed slash commands" and highlight which ones the Toolbox owns.
 */
export async function listInstalledCommands(
  homeDir: string,
  workspaceRoot?: string
): Promise<InstalledCommand[]> {
  const out: InstalledCommand[] = [];
  for (const scope of ["user", "workspace"] as const) {
    const dir = commandsDirForScope(scope, homeDir, workspaceRoot);
    if (!dir) continue;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      const filePath = path.join(dir, entry.name);
      let text = "";
      try {
        text = await fs.readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const fmMatch = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
      const fm = fmMatch ? fmMatch[1] : "";
      const descMatch = fm.match(/^\s*description:\s*(.+?)\s*$/m);
      const hintMatch = fm.match(/^\s*argument-hint:\s*(.+?)\s*$/m);
      out.push({
        id: entry.name.replace(/\.md$/i, ""),
        filePath,
        scope,
        description: descMatch ? descMatch[1].replace(/^["']|["']$/g, "") : undefined,
        argumentHint: hintMatch ? hintMatch[1].replace(/^["']|["']$/g, "") : undefined,
        ownedByToolbox: text.includes(COMMANDS_PACK_MARKER),
      });
    }
  }
  return out;
}
