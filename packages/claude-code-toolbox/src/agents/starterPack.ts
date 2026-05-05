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
  listInstalledCommands,
} from "./commandsPack";
import {
  createCommand,
  updateCommand,
  type CommandDraft,
} from "./commandsMutations";

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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
    model: "",
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
  {
    id: "designer",
    title: "UI/UX Designer",
    role: "plan",
    model: "",
    color: "#ff79c6",
    description: "Thinks through UI/UX, references Figma designs, and proposes component layouts.",
    tools: ["Read", "Grep", "Glob"],
    defaultSelected: true,
    systemPrompt: [
      "You are a senior UI/UX designer embedded in an engineering team.",
      "",
      "Your responsibilities:",
      "1. Review existing Figma designs, mockups, or design tokens in the repo.",
      "2. Propose component hierarchy, layout, spacing, and interaction patterns.",
      "3. Flag accessibility concerns (contrast, focus order, ARIA, touch targets).",
      "4. Suggest responsive breakpoints and edge-case states (empty, loading, error, overflow).",
      "5. When a Figma file or design spec is referenced, describe the relevant frames",
      "   and how they map to components the frontend dev should build.",
      "",
      "Output a `## Design spec` section with component tree, key measurements,",
      "and interaction notes. Do NOT write code — hand off to the frontend developer.",
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
  /** Swarm slash commands synced for each written team. */
  commandsSynced: string[];
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
  runtime: "native" | "custom";
  maxTurns: number;
  agents: string[];
  codePhaseAgents: string[];
  judge?: string;
  requires: string[];
  defaultSelected: boolean;
}> = [
  {
    name: "debate-team",
    description:
      "Multi-agent debate: architect vs security-reviewer with product-manager context. Final verdict included.",
    protocol: "debate",
    runtime: "custom",
    maxTurns: 3,
    agents: ["product-manager", "architect", "security-reviewer"],
    codePhaseAgents: [],
    judge: "architect",
    requires: ["product-manager", "architect", "security-reviewer"],
    defaultSelected: true,
  },
  {
    name: "plan-team",
    description:
      "Plan-phase team (product-manager + architect) produces a design recommendation.",
    protocol: "native-task",
    runtime: "native",
    maxTurns: 20,
    agents: ["product-manager", "architect"],
    codePhaseAgents: [],
    requires: ["product-manager", "architect"],
    defaultSelected: true,
  },
  {
    name: "review-team",
    description:
      "Review the pending diff with code-reviewer then security-reviewer. Produces a blocking/nit grouped report.",
    protocol: "native-task",
    runtime: "native",
    maxTurns: 20,
    agents: ["code-reviewer", "security-reviewer"],
    codePhaseAgents: [],
    requires: ["code-reviewer", "security-reviewer"],
    defaultSelected: true,
  },
  {
    name: "security-team",
    description:
      "Threat-model the user's change with security-reviewer only. OWASP-oriented.",
    protocol: "native-task",
    runtime: "native",
    maxTurns: 20,
    agents: ["security-reviewer"],
    codePhaseAgents: [],
    requires: ["security-reviewer"],
    defaultSelected: true,
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
    defaultSelected: true,
  },
  {
    name: "refactor-team",
    description:
      "Refactor coordinator: backend-dev + frontend-dev + qa-test-engineer with a code-reviewer wrap-up.",
    protocol: "native-task",
    runtime: "native",
    maxTurns: 20,
    agents: ["backend-dev", "frontend-dev", "qa-test-engineer", "code-reviewer"],
    codePhaseAgents: [],
    requires: ["backend-dev", "frontend-dev", "qa-test-engineer", "code-reviewer"],
    defaultSelected: false,
  },
  {
    name: "spec-team",
    description:
      "Turn a rough idea into a spec: product-manager writes PRD, architect adds technical addendum.",
    protocol: "native-task",
    runtime: "native",
    maxTurns: 20,
    agents: ["product-manager", "architect"],
    codePhaseAgents: [],
    requires: ["product-manager", "architect"],
    defaultSelected: false,
  },
];

function buildSwarmCommandBody(teamName: string, agents: string[], protocol: string): string {
  const lines: string[] = [];
  lines.push(`You are the orchestrator for the **${teamName}** agent team (protocol: ${protocol}).`);
  lines.push("");
  lines.push("## Swarm dispatch");
  lines.push("");
  lines.push("Use the **Task** tool to dispatch ALL of these agents **in parallel** (send every Task call in a single response so they run concurrently):");
  lines.push("");
  for (const a of agents) {
    lines.push(`- \`${a}\``);
  }
  lines.push("");
  lines.push("Each agent receives the full task below. They work independently and simultaneously as a swarm.");
  lines.push("");
  lines.push("## After all agents respond");
  lines.push("");
  lines.push("1. Review every agent's output");
  lines.push("2. Resolve conflicts or contradictions");
  lines.push("3. Synthesize a single, cohesive response that incorporates the strongest contributions from each agent");
  lines.push("");
  lines.push("## Task");
  lines.push("");
  lines.push("$ARGUMENTS");
  return lines.join("\n");
}

async function syncSwarmCommandForTeam(
  teamName: string,
  agents: string[],
  protocol: string,
  description: string,
  scope: "user" | "workspace",
  homeDir: string,
  workspaceRoot?: string,
): Promise<string | undefined> {
  try {
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const commands = await listInstalledCommands(homeDir, workspaceRoot);
    const existing = commands.find((c) => c.id === slug);
    const body = buildSwarmCommandBody(teamName, agents, protocol);
    const draft: CommandDraft = {
      name: slug,
      description,
      argumentHint: "<task description>",
      agents,
      instructions: body,
      scope,
    };
    if (existing) {
      await updateCommand(existing, draft, homeDir, workspaceRoot);
    } else {
      await createCommand(draft, homeDir, workspaceRoot);
    }
    return slug;
  } catch {
    return undefined;
  }
}

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

  /* Sync swarm slash commands for each written team. */
  const commandsSynced: string[] = [];
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
    for (const preset of SDLC_STARTER_TEAMS) {
      if (!preset.requires.every((id) => installedAgents.has(id))) continue;
      const synced = await syncSwarmCommandForTeam(
        preset.name,
        preset.agents,
        preset.protocol,
        preset.description,
        opts.scope,
        opts.homeDir,
        opts.workspaceRoot,
      );
      if (synced) commandsSynced.push(synced);
    }
  } catch {
    /* swarm command sync is best-effort */
  }

  return { written, skipped, targetDir: dir, teamsWritten, commandsSynced };
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
