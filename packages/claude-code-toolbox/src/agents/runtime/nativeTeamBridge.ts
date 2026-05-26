/**
 * NativeTeamBridge — spawns a Claude Code lead session with native Agent Teams
 * enabled. The lead orchestrates teammates directly via Claude Code's built-in
 * team coordination (shared task list + mailbox messaging).
 *
 * ToolBox constructs the lead's prompt to include:
 *   - Team roster (agents, roles, tools)
 *   - Protocol-specific coordination instructions
 *   - Aggregated long-term memory for each teammate
 *   - The user's task
 *
 * The bridge streams the lead's output and translates native team events
 * (teammate_spawned, teammate_idle, task_created, task_completed) into ToolBox
 * RunBus events so the dashboard and transcript UI work seamlessly.
 */
import * as fs from "node:fs/promises";
import type { AgentEntry } from "../localAgents";
import type { TeamEntry } from "../teamsStore";
import { memoryPathForAgent } from "../agentsMutations";
import { resolveClaudeBin } from "../claudeCliResolver";
import type { AgentRunEvent, RunPhase } from "./eventTypes";
import { nowIso } from "./eventTypes";
import { runClaudeAndEmit, ClaudeCliMissingError } from "./claudeSpawn";
import type { Protocol, ProtocolContext, ProtocolResult } from "./runtimeTypes";
import { makeTotals, addUsage } from "./protocols/shared";

export type NativeTeamBridgeOptions = {
  maxConcurrent?: number;
};

async function readMemory(agentFilePath: string): Promise<string | undefined> {
  try {
    const memPath = memoryPathForAgent(agentFilePath);
    const text = await fs.readFile(memPath, "utf8");
    return text.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function buildMemoryBlock(agents: AgentEntry[]): Promise<string> {
  const sections: string[] = [];
  for (const agent of agents) {
    if (!agent.longTermMemory || !agent.filePath) {
      continue;
    }
    const memory = await readMemory(agent.filePath);
    if (memory) {
      sections.push(`### ${agent.name}\n${memory}`);
    }
  }
  if (!sections.length) {
    return "";
  }
  return `\n## Agent Long-Term Memories\n\n${sections.join("\n\n")}\n`;
}

function buildTeamRoster(agents: AgentEntry[]): string {
  const lines = agents.map(
    (a) => `- **${a.name}** (${a.role}): ${a.description}${a.model ? ` [model: ${a.model}]` : ""}`
  );
  return `## Team Roster\n\n${lines.join("\n")}`;
}

function buildProtocolInstructions(team: TeamEntry): string {
  switch (team.protocol) {
    case "parallel-fan-out":
      return [
        "## Coordination Protocol: Parallel Fan-Out",
        "",
        "1. Spawn ALL teammates listed above simultaneously",
        "2. Give each teammate the same task",
        "3. Wait for all teammates to complete (idle)",
        "4. Synthesize their responses into a single cohesive answer",
        "5. Resolve contradictions and highlight consensus",
      ].join("\n");

    case "round-robin":
      return [
        "## Coordination Protocol: Round-Robin",
        "",
        "1. Send the task to the first teammate",
        "2. Pass their response to the next teammate for review/extension",
        "3. Continue cycling through all teammates",
        `4. Complete after ${team.maxTurns} total turns or when consensus is reached`,
        "5. Present the final synthesized answer",
      ].join("\n");

    case "handoff":
      return [
        "## Coordination Protocol: Handoff",
        "",
        "1. Send the task to the first teammate",
        "2. Each teammate decides who should go next based on the task needs",
        "3. Teammates hand off to the most relevant specialist",
        "4. When no further handoff is needed, present the final answer",
      ].join("\n");

    case "debate":
      return [
        "## Coordination Protocol: Debate",
        "",
        `1. Run ${Math.max(1, Math.floor(team.maxTurns / team.agents.length))} rounds of debate`,
        "2. Each round: every teammate responds to the topic, seeing prior arguments",
        "3. Teammates should challenge, refine, and build on each other's positions",
        "4. After all rounds, synthesize a verdict addressing all perspectives",
        team.judge ? `5. The judge (${team.judge}) makes the final decision` : "",
      ].filter(Boolean).join("\n");

    case "orchestrator":
      return [
        "## Coordination Protocol: Orchestrator",
        "",
        `You are the orchestrator. Route tasks to specialist teammates as needed:`,
        "1. Analyze the task and break it into specialist-appropriate chunks",
        "2. Send each chunk to the most relevant teammate",
        "3. Collect results and route follow-ups as needed",
        "4. Synthesize the final answer from all specialist outputs",
      ].join("\n");

    case "plan-then-code":
      return [
        "## Coordination Protocol: Plan-Then-Code",
        "",
        "### Phase 1: Planning",
        `1. Have plan-phase teammates (${team.agents.join(", ")}) collaborate on a plan`,
        "2. Wrap the final plan in <plan>...</plan> tags",
        "",
        "### Phase 2: Implementation (after plan approval)",
        `3. Have code-phase teammates (${(team.codePhaseAgents.length ? team.codePhaseAgents : team.agents).join(", ")}) implement the plan`,
        team.judge ? `4. Have ${team.judge} review the implementation` : "",
      ].filter(Boolean).join("\n");

    case "converge":
      return [
        "## Coordination Protocol: Converge",
        "",
        "### Phase 1: Diverge",
        "1. All teammates think about the task independently (spawn in parallel)",
        "",
        "### Phase 2: Cross-Pollinate",
        "2. Share each teammate's output with all others",
        "3. Each refines their position seeing peers' work",
        "",
        "### Phase 3: Synthesize",
        "4. Produce a single cohesive plan/answer from all perspectives",
      ].join("\n");

    default:
      return [
        "## Coordination Protocol: Native Task",
        "",
        "Use your best judgment to coordinate teammates. Spawn them as needed,",
        "assign tasks, and synthesize results.",
      ].join("\n");
  }
}

function buildLeadPrompt(team: TeamEntry, agents: AgentEntry[], userPrompt: string, memoryBlock: string): string {
  const parts = [
    `You are the team lead for "${team.name}".`,
    `You have ${agents.length} teammates available. Spawn and coordinate them using native Agent Teams.`,
    "",
    buildTeamRoster(agents),
    "",
    buildProtocolInstructions(team),
    "",
  ];
  if (memoryBlock) {
    parts.push(memoryBlock, "");
  }
  parts.push(
    "## Task",
    "",
    userPrompt,
  );
  return parts.join("\n");
}

/**
 * Enhanced stream-json parser that intercepts native Agent Teams events and
 * translates them while also passing through standard events.
 */
async function* streamWithTeamEvents(
  binPath: string,
  args: string[],
  runId: string,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutSec?: number }
): AsyncIterable<AgentRunEvent> {
  for await (const ev of runClaudeAndEmit(
    binPath,
    args,
    { runId, agent: "lead", phase: "none" as RunPhase },
    opts
  )) {
    yield ev;
  }
}

export function makeNativeTeamBridge(_opts?: NativeTeamBridgeOptions): Protocol {
  return async (ctx: ProtocolContext): Promise<ProtocolResult> => {
    const totals = makeTotals();
    const binPath = await resolveClaudeBin(ctx.claudeBin);
    if (!binPath) {
      throw new ClaudeCliMissingError();
    }

    const memoryBlock = await buildMemoryBlock(ctx.agents);
    const leadPrompt = buildLeadPrompt(ctx.team, ctx.agents, ctx.userPrompt, memoryBlock);

    const agentNames = ctx.agents.map((a) => a.name);
    const args = [
      "-p",
      leadPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ];
    if (agentNames.length) {
      args.push("--allowed-agents", agentNames.join(","));
    }

    const env: NodeJS.ProcessEnv = {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
    };

    ctx.bus.emit({
      kind: "log",
      t: nowIso(),
      runId: ctx.runId,
      level: "info",
      message: `Starting native Agent Teams session with ${ctx.agents.length} teammates`,
    });

    let status: "completed" | "aborted" | "error" = "completed";
    const teammateTracker = new Set<string>();

    try {
      for await (const ev of streamWithTeamEvents(
        binPath,
        args,
        ctx.runId,
        { cwd: ctx.cwd, env, signal: ctx.signal, timeoutSec: 600 }
      )) {
        ctx.bus.emit(ev);

        if (ev.kind === "usage") {
          addUsage(totals, ev.usage);
        }
        if (ev.kind === "error") {
          status = "error";
        }
        if (ev.kind === "tool_use" && ev.tool === "Task") {
          const input = ev.input as Record<string, unknown> | undefined;
          const subagent = typeof input?.subagent_type === "string" ? input.subagent_type : undefined;
          if (subagent && !teammateTracker.has(subagent)) {
            teammateTracker.add(subagent);
            ctx.bus.emit({
              kind: "teammate_spawned",
              t: nowIso(),
              runId: ctx.runId,
              teammate: subagent,
              agentType: subagent,
              status: "running",
            });
          }
        }
        if (ev.kind === "agent_end" && ev.agent !== "lead") {
          ctx.bus.emit({
            kind: "teammate_idle",
            t: nowIso(),
            runId: ctx.runId,
            teammate: ev.agent,
          });
        }
      }
    } catch (e) {
      status = "error";
      ctx.bus.emit({
        kind: "error",
        t: nowIso(),
        runId: ctx.runId,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    if (ctx.signal.aborted) {
      status = "aborted";
    }

    return { status, totals };
  };
}
