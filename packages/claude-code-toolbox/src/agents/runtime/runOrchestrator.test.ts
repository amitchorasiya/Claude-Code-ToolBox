import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEntry } from "../localAgents";
import type { TeamEntry } from "../teamsStore";
import { nowIso, type AgentRunEvent } from "./eventTypes";
import { abortRun, resolvePendingApproval, startTeamRun } from "./runOrchestrator";
import { getRun, pruneTerminalRuns } from "./runRegistry";
import type { SpawnAgentTurnFn } from "./runtimeTypes";

function agent(name: string): AgentEntry {
  return {
    id: `user:/tmp/${name}.md`,
    name,
    description: "",
    role: "both",
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
    name: "team",
    description: "",
    protocol: "round-robin",
    runtime: "custom",
    maxTurns: 4,
    agents: ["a", "b"],
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
      durationMs: 1,
    };
  };
}

describe("runOrchestrator", () => {
  it("dispatches round-robin and writes a JSONL transcript", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-orch-"));
    const agents = [agent("a"), agent("b")];
    const { run, finished } = startTeamRun({
      team: team({ protocol: "round-robin", maxTurns: 2 }),
      agents,
      userPrompt: "do the thing",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a, turn }) => `${a.name} turn ${turn}`),
    });
    expect(getRun(run.runId)?.status).toBe("running");
    const result = await finished;
    expect(result.status).toBe("completed");
    const transcript = await fs.readFile(run.jsonlPath, "utf8");
    const lines = transcript.trim().split("\n");
    expect(lines.length).toBeGreaterThan(3);
    /* Every line must be valid JSON. */
    for (const line of lines) {
      JSON.parse(line);
    }
    /* And the run must have ended. */
    const endLine = lines.find((l) => l.includes('"kind":"run_end"'));
    expect(endLine).toBeDefined();
  });

  it("respects stop: aborts mid-run and ends with status=aborted", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-orch-stop-"));
    let aborted = false;
    const { run, finished } = startTeamRun({
      team: team({ protocol: "round-robin", maxTurns: 8 }),
      agents: [agent("a"), agent("b"), agent("c")],
      userPrompt: "keep going",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: async function* ({ agent: a, runId, turn, phase, signal }) {
        yield { kind: "agent_start", t: nowIso(), runId, agent: a.name, turn, phase };
        /* Long enough that the stop has a chance to land. */
        await new Promise((r) => setTimeout(r, 20));
        yield {
          kind: "assistant_delta",
          t: nowIso(),
          runId,
          agent: a.name,
          text: `turn ${turn}`,
        };
        if (signal?.aborted) {
          aborted = true;
        }
        yield {
          kind: "agent_end",
          t: nowIso(),
          runId,
          agent: a.name,
          turn,
          status: signal?.aborted ? "aborted" : "ok",
          durationMs: 1,
        };
      },
    });
    /* Abort shortly after start. */
    setTimeout(() => abortRun(run), 30);
    const result = await finished;
    expect(result.status).toBe("aborted");
    expect(aborted).toBe(true);
  });

  it("plan-then-code: pending approval is visible in registry and resolvePendingApproval unblocks", async () => {
    pruneTerminalRuns();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-orch-plan-"));
    const agents = [agent("pm"), agent("dev")];
    const { run, finished } = startTeamRun({
      team: team({
        protocol: "plan-then-code",
        runtime: "custom",
        agents: ["pm"],
        codePhaseAgents: ["dev"],
      }),
      agents,
      userPrompt: "build X",
      workspaceRoot: tmp,
      spawnAgentTurnOverride: scripted(({ agent: a }) => {
        if (a.name === "pm") return "<plan>do X carefully</plan>";
        return "built X";
      }),
    });
    /* Wait until the run reports awaiting_approval. */
    const deadline = Date.now() + 2000;
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
  });
});
