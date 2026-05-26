/**
 * Integration tests for native Agent Teams runtime and hybrid spawner.
 *
 * These tests use scripted spawners (no real CLI) to verify:
 * - The hybrid spawner emits teammate visibility events
 * - Debate protocol works with agent-teams runtime + hybrid spawner
 * - Plan-then-code works with agent-teams runtime + approval gate
 * - Converge protocol works with agent-teams runtime
 * - Orchestrator protocol works with agent-teams runtime
 * - The NativeTeamBridge protocol selection works for simple protocols
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEntry } from "../localAgents";
import type { TeamEntry } from "../teamsStore";
import { nowIso, type AgentRunEvent } from "./eventTypes";
import { resolvePendingApproval, startTeamRun } from "./runOrchestrator";
import { pruneTerminalRuns } from "./runRegistry";
import type { SpawnAgentTurnFn } from "./runtimeTypes";

function agent(name: string, role = "plan"): AgentEntry {
  return {
    id: `user:/tmp/${name}.md`,
    name,
    description: `${name} agent`,
    role,
    model: "",
    tools: [],
    color: "#abcabc",
    filePath: `/tmp/${name}.md`,
    systemPrompt: `You are ${name}.`,
    scope: "user",
  };
}

function team(partial: Partial<TeamEntry>): TeamEntry {
  return {
    id: "user:/tmp/team.json",
    name: "test-team",
    description: "",
    protocol: "debate",
    runtime: "agent-teams",
    maxTurns: 3,
    agents: ["architect", "security-reviewer"],
    codePhaseAgents: [],
    scope: "user",
    filePath: "/tmp/team.json",
    ...partial,
  };
}

function scripted(fn: (args: { agent: AgentEntry; turn: number }) => string): SpawnAgentTurnFn {
  return async function* ({ agent: a, runId, turn, phase }) {
    yield { kind: "agent_start", t: nowIso(), runId, agent: a.name, color: a.color, turn, phase };
    yield {
      kind: "assistant_delta",
      t: nowIso(),
      runId,
      agent: a.name,
      text: fn({ agent: a, turn }),
    };
    yield {
      kind: "agent_end",
      t: nowIso(),
      runId,
      agent: a.name,
      turn,
      status: "ok",
      durationMs: 10,
    };
  };
}

describe("native Agent Teams — hybrid protocols", () => {
  it("debate with agent-teams runtime emits teammate_spawned and teammate_idle events", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-native-debate-"));
    const agents = [agent("architect"), agent("security-reviewer"), agent("product-manager")];
    const events: AgentRunEvent[] = [];

    const { run, finished } = startTeamRun({
      team: team({
        protocol: "debate",
        runtime: "agent-teams",
        maxTurns: 2,
        agents: ["architect", "security-reviewer"],
        judge: "product-manager",
      }),
      agents,
      userPrompt: "Should we use JWT or session tokens?",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a, turn }) => {
        if (a.name === "product-manager") {
          return "<decision>Use JWT with short expiry + refresh tokens. Both sides made valid points but JWT wins for API scalability.</decision>";
        }
        return `${a.name} argues their point in turn ${turn}`;
      }),
    });

    run.bus.on((ev) => events.push(ev));
    const result = await finished;

    expect(result.status).toBe("completed");

    const spawned = events.filter((e) => e.kind === "teammate_spawned");
    const idle = events.filter((e) => e.kind === "teammate_idle");

    expect(spawned.length).toBeGreaterThanOrEqual(2);
    expect(idle.length).toBeGreaterThanOrEqual(2);

    const spawnedNames = spawned.map((e) => (e as { teammate: string }).teammate);
    expect(spawnedNames).toContain("architect");
    expect(spawnedNames).toContain("security-reviewer");

    expect(result.planArtifactPath).toContain("decision.md");
  });

  it("plan-then-code with agent-teams runtime preserves approval gate", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-native-ptc-"));
    const agents = [agent("pm", "plan"), agent("arch", "plan"), agent("dev", "code")];
    const events: AgentRunEvent[] = [];

    const { run, finished } = startTeamRun({
      team: team({
        protocol: "plan-then-code",
        runtime: "agent-teams",
        agents: ["pm", "arch"],
        codePhaseAgents: ["dev"],
        maxTurns: 10,
      }),
      agents,
      userPrompt: "Build a user authentication system",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a }) => {
        if (a.name === "pm") return "Acceptance criteria: login, logout, password reset.";
        if (a.name === "arch") return "<plan>1. Create auth module\n2. Add JWT middleware\n3. Write tests</plan>";
        return "Implemented auth module with JWT.";
      }),
    });

    run.bus.on((ev) => events.push(ev));

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (run.pendingApproval) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(run.pendingApproval).toBeDefined();

    const ok = resolvePendingApproval(run, "approve");
    expect(ok).toBe(true);

    const result = await finished;
    expect(result.status).toBe("completed");
    expect(result.planArtifactPath).toContain("plan.md");

    const spawned = events.filter((e) => e.kind === "teammate_spawned");
    expect(spawned.length).toBeGreaterThanOrEqual(2);

    const phases = events.filter((e) => e.kind === "phase_boundary");
    expect(phases.length).toBeGreaterThanOrEqual(1);
  });

  it("converge with agent-teams runtime runs parallel phases with teammate visibility", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-native-converge-"));
    const agents = [agent("a1"), agent("a2"), agent("judge")];
    const events: AgentRunEvent[] = [];

    const { run, finished } = startTeamRun({
      team: team({
        protocol: "converge",
        runtime: "agent-teams",
        agents: ["a1", "a2"],
        codePhaseAgents: [],
        judge: "judge",
        maxTurns: 1,
      }),
      agents,
      userPrompt: "Design the data model",
      workspaceRoot: tmp,
      maxConcurrentAgents: 2,
      spawnAgentTurnOverride: scripted(({ agent: a }) => {
        if (a.name === "judge") return "<plan>Use normalized schema with users, roles, permissions tables.</plan>";
        return `${a.name} suggests a schema approach`;
      }),
    });

    run.bus.on((ev) => events.push(ev));

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (run.pendingApproval) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(run.pendingApproval).toBeDefined();
    resolvePendingApproval(run, "approve");

    const result = await finished;
    expect(result.status).toBe("completed");

    const spawned = events.filter((e) => e.kind === "teammate_spawned");
    expect(spawned.length).toBeGreaterThanOrEqual(2);
  });

  it("orchestrator with agent-teams runtime shows routing with teammate events", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-native-orch-"));
    const agents = [agent("lead", "plan"), agent("backend", "code"), agent("frontend", "code")];
    let routeCount = 0;

    const { run, finished } = startTeamRun({
      team: team({
        protocol: "orchestrator",
        runtime: "agent-teams",
        agents: ["lead", "backend", "frontend"],
        orchestrator: "lead",
        maxTurns: 6,
      }),
      agents,
      userPrompt: "Build a login form",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a }) => {
        if (a.name === "lead") {
          routeCount++;
          if (routeCount === 1) return "Need backend first.\nROUTE: backend implement auth endpoint";
          if (routeCount === 2) return "Now frontend.\nROUTE: frontend build login form";
          return "All done.\nROUTE: done";
        }
        return `${a.name} completed the task`;
      }),
    });

    const events: AgentRunEvent[] = [];
    run.bus.on((ev) => events.push(ev));

    const result = await finished;
    expect(result.status).toBe("completed");

    const spawned = events.filter((e) => e.kind === "teammate_spawned");
    expect(spawned.length).toBeGreaterThanOrEqual(2);

    const messages = events.filter((e) => e.kind === "message");
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it("agent-teams runtime falls back to protocol state machine for complex protocols", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-native-fallback-"));
    const agents = [agent("a"), agent("b")];

    const { finished } = startTeamRun({
      team: team({
        protocol: "debate",
        runtime: "agent-teams",
        maxTurns: 1,
        agents: ["a", "b"],
        judge: "a",
      }),
      agents,
      userPrompt: "test",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a }) => {
        if (a.name === "a") return "<decision>Verdict: go ahead</decision>";
        return "I agree";
      }),
    });

    const result = await finished;
    expect(result.status).toBe("completed");
  });
});
