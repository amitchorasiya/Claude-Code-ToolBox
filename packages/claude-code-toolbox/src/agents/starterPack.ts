/**
 * SDLC starter pack — 9 ready-to-use Claude Code subagents.
 *
 * Each template is a native `.md` agent file; installer writes them to the
 * user's `~/.claude/agents/` (or workspace `.claude/agents/`), skipping any
 * files that already exist unless `overwrite` is requested.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { agentsDirForScope, type AgentRole } from "./localAgents";
import { atomicWriteText } from "./atomicFile";
import {
  SDLC_COMMANDS,
  commandsPackDefaultSelection,
  installCommandsPack,
  type InstallCommandsPackResult,
} from "./commandsPack";

export type StarterPackAgent = {
  /** Stable id used by the UI checkbox. Matches the agent `name` frontmatter. */
  id: string;
  title: string;
  role: AgentRole;
  model: string;
  color: string;
  description: string;
  tools: string[];
  /** System prompt body written below the frontmatter. */
  systemPrompt: string;
  /** Pre-checked in the installer UI by default. */
  defaultSelected: boolean;
};

export const SDLC_STARTER_PACK: readonly StarterPackAgent[] = [
  {
    id: "product-manager",
    title: "Product Manager",
    role: "plan",
    model: "claude-sonnet-4-5",
    color: "#f48771",
    description: "Clarifies user intent, shapes acceptance criteria, owns the brief.",
    tools: ["Read", "Grep"],
    defaultSelected: true,
    systemPrompt: [
      "You are a senior product manager on a software team.",
      "",
      "Your job in every run:",
      "1. Restate the user's intent in 2-3 sentences.",
      "2. List 3-7 crisp acceptance criteria (each testable).",
      "3. Flag open questions that would change the scope.",
      "4. Do NOT propose implementations — that belongs to the architect.",
      "",
      "Always finish with a bulleted `## Acceptance criteria` section.",
    ].join("\n"),
  },
  {
    id: "architect",
    title: "Architect",
    role: "plan",
    model: "claude-opus-4-7",
    color: "#569cd6",
    description: "Designs the approach, picks patterns, and gates the plan.",
    tools: ["Read", "Grep", "Glob"],
    defaultSelected: true,
    systemPrompt: [
      "You are a staff software architect.",
      "",
      "Given the product manager's acceptance criteria plus the codebase context,",
      "you design the approach. Output a plan with:",
      "- the integration point(s) and why,",
      "- data model changes,",
      "- failure modes and observability,",
      "- alternatives considered and rejected (one line each).",
      "",
      "When asked to judge a plan, reply with APPROVE or REVISE plus the specific concern.",
    ].join("\n"),
  },
  {
    id: "security-reviewer",
    title: "Security Reviewer",
    role: "review",
    model: "claude-opus-4-7",
    color: "#c586c0",
    description: "Threat-models plans and scans diffs for vulnerabilities.",
    tools: ["Read", "Grep", "Bash"],
    defaultSelected: true,
    systemPrompt: [
      "You are a security engineer reviewing plans and diffs.",
      "",
      "For plans: enumerate OWASP-relevant risks (authn/authz, injection, SSRF, secrets",
      "handling, deserialization, PII). One line per risk plus a mitigation.",
      "",
      "For diffs: only flag issues grounded in the actual code. Group findings by severity",
      "(critical / high / medium / low). If nothing is found, say so explicitly.",
    ].join("\n"),
  },
  {
    id: "backend-dev",
    title: "Backend Developer",
    role: "code",
    model: "claude-opus-4-7",
    color: "#4ec9b0",
    description: "Implements server-side code and APIs to match the approved plan.",
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
    defaultSelected: true,
    systemPrompt: [
      "You are a senior backend engineer.",
      "",
      "Follow the approved plan exactly. Do not introduce scope. When an assumption",
      "is required and the plan is silent, state it at the top of your response and",
      "proceed. Prefer small, reviewable edits over rewrites.",
    ].join("\n"),
  },
  {
    id: "frontend-dev",
    title: "Frontend Developer",
    role: "code",
    model: "claude-opus-4-7",
    color: "#9cdcfe",
    description: "Implements UI and client-side logic to match the approved plan.",
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
    defaultSelected: true,
    systemPrompt: [
      "You are a senior frontend engineer.",
      "",
      "Ship small, accessible, typed components. Follow existing patterns in the",
      "codebase before inventing new ones. Keep loading and error states honest.",
    ].join("\n"),
  },
  {
    id: "qa-test-engineer",
    title: "QA / Test Engineer",
    role: "code",
    model: "claude-sonnet-4-5",
    color: "#b5cea8",
    description: "Writes unit and integration tests for new features and regressions.",
    tools: ["Read", "Edit", "Write", "Bash", "Grep"],
    defaultSelected: true,
    systemPrompt: [
      "You are a QA engineer. For each acceptance criterion from the plan,",
      "produce at least one test. Prefer integration tests over unit mocks when",
      "they catch real bugs. Include the command to run the tests in your reply.",
    ].join("\n"),
  },
  {
    id: "code-reviewer",
    title: "Code Reviewer",
    role: "review",
    model: "claude-opus-4-7",
    color: "#dcdcaa",
    description: "Reviews diffs, requests changes, approves at the end.",
    tools: ["Read", "Grep", "Bash"],
    defaultSelected: true,
    systemPrompt: [
      "You are a code reviewer. Read the diff (`git diff`), then report findings",
      "grouped by severity. Distinguish `blocking` (must fix) from `nit` (optional).",
      "End with one of APPROVE / REQUEST_CHANGES.",
    ].join("\n"),
  },
  {
    id: "devops",
    title: "DevOps Engineer",
    role: "code",
    model: "claude-sonnet-4-5",
    color: "#ce9178",
    description: "Handles CI/CD, infrastructure, and deployment configs.",
    tools: ["Read", "Edit", "Write", "Bash", "Grep"],
    defaultSelected: false,
    systemPrompt: [
      "You are a DevOps engineer. You touch CI pipelines, Dockerfiles, IaC, and",
      "deployment manifests. Keep changes minimal and idempotent. Always preview",
      "the effect (plan/dry-run) before recommending an apply.",
    ].join("\n"),
  },
  {
    id: "tech-writer",
    title: "Tech Writer",
    role: "code",
    model: "claude-haiku-4-5-20251001",
    color: "#d7ba7d",
    description: "Updates README, changelog, and in-repo docs for shipped changes.",
    tools: ["Read", "Edit", "Write"],
    defaultSelected: false,
    systemPrompt: [
      "You are a technical writer. Given the diff and plan, update the README,",
      "changelog, and any affected doc files. Write for a developer who has never",
      "seen this PR. Keep the tone matter-of-fact and short.",
    ].join("\n"),
  },
];

function escapeYamlScalar(value: string): string {
  if (value === "") {
    return '""';
  }
  if (/^[A-Za-z0-9 _./,:;@#?!+-]+$/.test(value) && !/^[\s-]/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function renderStarterAgentMarkdown(a: StarterPackAgent): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${escapeYamlScalar(a.id)}`);
  lines.push(`description: ${escapeYamlScalar(a.description)}`);
  lines.push(`role: ${a.role}`);
  lines.push(`model: ${escapeYamlScalar(a.model)}`);
  lines.push(`tools: [${a.tools.map((t) => escapeYamlScalar(t)).join(", ")}]`);
  lines.push(`color: ${escapeYamlScalar(a.color)}`);
  lines.push("---");
  lines.push("");
  lines.push(a.systemPrompt.trim());
  lines.push("");
  return lines.join("\n");
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await atomicWriteText(filePath, content);
}

export type StarterPackInstallOptions = {
  selected: readonly string[];
  scope: "user" | "workspace";
  overwrite?: boolean;
  homeDir: string;
  workspaceRoot?: string;
};

export type StarterPackInstallResult = {
  written: string[];
  skipped: string[];
  targetDir: string;
  /** Team JSON paths written during install (empty when no eligible preset teams). */
  teamsWritten: string[];
  /** Slash-command bridge files written (e.g. /plan-team, /debate-team). */
  commandsInstalled?: InstallCommandsPackResult;
};

/**
 * Preset teams shipped alongside the starter pack. Each preset's
 * `requires` list names the starter-pack agent ids that must exist for the
 * team to be usable; we skip the preset if any are missing. Phase 2.
 */
export const SDLC_STARTER_TEAMS: ReadonlyArray<{
  name: string;
  description: string;
  protocol: string;
  runtime: "custom";
  maxTurns: number;
  agents: string[];
  codePhaseAgents: string[];
  judge?: string;
  requires: string[];
}> = [
  {
    name: "sdlc-debate",
    description:
      "Debate: product-manager, architect, and security-reviewer argue the plan; architect judges.",
    protocol: "debate",
    runtime: "custom",
    maxTurns: 3,
    agents: ["product-manager", "architect", "security-reviewer"],
    codePhaseAgents: [],
    judge: "architect",
    requires: ["product-manager", "architect", "security-reviewer"],
  },
  {
    name: "sdlc-plan-then-code",
    description:
      "Plan → Code with approval gate. Plan agents produce plan.md; code agents execute after you approve.",
    protocol: "plan-then-code",
    runtime: "custom",
    maxTurns: 20,
    agents: ["product-manager", "architect", "security-reviewer"],
    codePhaseAgents: ["backend-dev", "frontend-dev", "qa-test-engineer", "code-reviewer"],
    judge: "architect",
    requires: ["product-manager", "architect", "backend-dev"],
  },
];

export async function installSdlcStarterPack(
  opts: StarterPackInstallOptions
): Promise<StarterPackInstallResult> {
  const dir = agentsDirForScope(opts.scope, opts.homeDir, opts.workspaceRoot);
  if (!dir) {
    throw new Error("Open a workspace folder to install workspace-scope agents.");
  }
  await fs.mkdir(dir, { recursive: true });
  const selectedSet = new Set(opts.selected);
  const written: string[] = [];
  const skipped: string[] = [];
  for (const agent of SDLC_STARTER_PACK) {
    if (!selectedSet.has(agent.id)) {
      continue;
    }
    const target = path.join(dir, `${agent.id}.md`);
    if (!opts.overwrite) {
      try {
        await fs.access(target);
        skipped.push(agent.id);
        continue;
      } catch {
        /* not present → write */
      }
    }
    await atomicWrite(target, renderStarterAgentMarkdown(agent));
    written.push(agent.id);
  }

  const teamsWritten = await writePresetTeamsIfEligible({
    scope: opts.scope,
    homeDir: opts.homeDir,
    workspaceRoot: opts.workspaceRoot,
    overwrite: opts.overwrite,
  });

  /* Also install slash-command bridges whose required agents now exist. */
  let commandsInstalled: InstallCommandsPackResult | undefined;
  try {
    const installedAgents = new Set<string>();
    for (const agent of SDLC_STARTER_PACK) {
      try {
        await fs.access(path.join(dir, `${agent.id}.md`));
        installedAgents.add(agent.id);
      } catch {
        /* not installed */
      }
    }
    const eligible = SDLC_COMMANDS.filter(
      (c) =>
        commandsPackDefaultSelection().includes(c.id) &&
        c.requires.every((a) => installedAgents.has(a))
    ).map((c) => c.id);
    if (eligible.length) {
      commandsInstalled = await installCommandsPack({
        selected: eligible,
        scope: opts.scope,
        homeDir: opts.homeDir,
        workspaceRoot: opts.workspaceRoot,
        overwrite: opts.overwrite,
      });
    }
  } catch {
    /* slash-command install is best-effort */
  }

  return { written, skipped, targetDir: dir, teamsWritten, commandsInstalled };
}

export type WritePresetTeamsOptions = {
  scope: "user" | "workspace";
  homeDir: string;
  workspaceRoot?: string;
  overwrite?: boolean;
};

/**
 * Scan the agents directory for starter-pack agents and write each preset
 * team whose required agents are present (skipping presets when a team JSON
 * already exists). Returns the list of written file paths.
 *
 * Best-effort: throws are swallowed so this can be called from enable flows
 * without masking the primary failure path.
 */
export async function writePresetTeamsIfEligible(
  opts: WritePresetTeamsOptions
): Promise<string[]> {
  const written: string[] = [];
  try {
    const dir = agentsDirForScope(opts.scope, opts.homeDir, opts.workspaceRoot);
    if (!dir) return written;
    const installedAgents = new Set<string>();
    for (const agent of SDLC_STARTER_PACK) {
      const p = path.join(dir, `${agent.id}.md`);
      try {
        await fs.access(p);
        installedAgents.add(agent.id);
      } catch {
        /* not installed */
      }
    }
    if (installedAgents.size === 0) return written;
    const teamsDir = path.join(
      opts.scope === "user" ? opts.homeDir : (opts.workspaceRoot ?? opts.homeDir),
      ".claude",
      "teams"
    );
    await fs.mkdir(teamsDir, { recursive: true });
    for (const preset of SDLC_STARTER_TEAMS) {
      if (!preset.requires.every((id) => installedAgents.has(id))) continue;
      const teamPath = path.join(teamsDir, `${preset.name}.json`);
      if (!opts.overwrite) {
        try {
          await fs.access(teamPath);
          continue;
        } catch {
          /* not present → write */
        }
      }
      const payload = {
        name: preset.name,
        description: preset.description,
        protocol: preset.protocol,
        runtime: preset.runtime,
        maxTurns: preset.maxTurns,
        agents: preset.agents.filter((id) => installedAgents.has(id)),
        codePhaseAgents: preset.codePhaseAgents.filter((id) => installedAgents.has(id)),
        judge: preset.judge && installedAgents.has(preset.judge) ? preset.judge : undefined,
      };
      await atomicWrite(teamPath, `${JSON.stringify(payload, null, 2)}\n`);
      written.push(teamPath);
    }
  } catch {
    /* best-effort */
  }
  return written;
}

/** IDs pre-checked by default in the installer UI. */
export function starterPackDefaultSelection(): string[] {
  return SDLC_STARTER_PACK.filter((a) => a.defaultSelected).map((a) => a.id);
}
