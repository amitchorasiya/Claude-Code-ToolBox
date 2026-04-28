import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEntry } from "../../localAgents";
import type { TeamEntry } from "../../teamsStore";
import { nowIso, type AgentRunEvent } from "../eventTypes";
import { RunBus } from "../runBus";
import type { ProtocolContext, SpawnAgentTurnFn, SpawnSessionFn } from "../runtimeTypes";
import { roundRobin } from "./roundRobin";
import { handoff } from "./handoff";
import { orchestrator } from "./orchestrator";
import { makeParallelFanout } from "./parallelFanout";
import { debate } from "./debate";
import { planThenCode } from "./planThenCode";
import { nativeTask } from "./nativeTask";

function mkAgent(name: string, role: AgentEntry["role"] = "code"): AgentEntry {
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

type ScriptFn = (args: { agent: AgentEntry; prompt: string; turn: number }) => string;

function scriptedSpawn(script: ScriptFn): SpawnAgentTurnFn {
  return async function* ({ agent, prompt, runId, turn, phase }) {
    yield { kind: "agent_start", t: nowIso(), runId, agent: agent.name, color: agent.color, turn, phase };
    const text = script({ agent, prompt, turn });
    yield { kind: "assistant_delta", t: nowIso(), runId, agent: agent.name, text };
    yield {
      kind: "usage",
      t: nowIso(),
      runId,
      agent: agent.name,
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.001 },
    };
    yield {
      kind: "agent_end",
      t: nowIso(),
      runId,
      agent: agent.name,
      turn,
      status: "ok",
      durationMs: 1,
    };
  };
}

function noopSession(): SpawnSessionFn {
  return async function* ({ runId, phase }) {
    yield { kind: "agent_start", t: nowIso(), runId, agent: "main", turn: 1, phase };
    yield { kind: "assistant_delta", t: nowIso(), runId, agent: "main", text: "native session output" };
    yield { kind: "agent_end", t: nowIso(), runId, agent: "main", turn: 1, status: "ok", durationMs: 1 };
  };
}

async function makeCtx(
  team: Partial<TeamEntry>,
  agents: AgentEntry[],
  spawn: SpawnAgentTurnFn,
  session: SpawnSessionFn = noopSession(),
  awaitApproval?: ProtocolContext["awaitApproval"]
): Promise<{ ctx: ProtocolContext; bus: RunBus; runDir: string; events: AgentRunEvent[] }> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-proto-"));
  const runDir = path.join(tmp, "run");
  const bus = new RunBus("rX", path.join(runDir, "t.jsonl"));
  const events: AgentRunEvent[] = [];
  bus.on((e) => events.push(e));
  const ctl = new AbortController();
  const fullTeam: TeamEntry = {
    id: "user:/tmp/team.json",
    name: "team",
    description: "",
    protocol: "round-robin",
    runtime: "custom",
    maxTurns: 6,
    agents: agents.map((a) => a.name),
    codePhaseAgents: [],
    scope: "user",
    filePath: "/tmp/team.json",
    ...team,
  };
  const ctx: ProtocolContext = {
    team: fullTeam,
    agents,
    userPrompt: "do the thing",
    bus,
    runId: "rX",
    signal: ctl.signal,
    runDir,
    spawnAgentTurn: spawn,
    spawnSession: session,
    awaitApproval,
  };
  return { ctx, bus, runDir, events };
}

describe("nativeTask protocol", () => {
  it("runs a single session and emits a main agent_start/end pair plus any inner Task handoffs", async () => {
    const agents = [mkAgent("a"), mkAgent("b")];
    const { ctx, events } = await makeCtx({ protocol: "native-task", runtime: "native" }, agents, scriptedSpawn(() => ""));
    const res = await nativeTask(ctx);
    expect(res.status).toBe("completed");
    const mainStarts = events.filter(
      (e) => e.kind === "agent_start" && (e as { agent: string }).agent === "main"
    );
    const mainEnds = events.filter(
      (e) => e.kind === "agent_end" && (e as { agent: string }).agent === "main"
    );
    expect(mainStarts.length).toBeGreaterThanOrEqual(1);
    expect(mainEnds.length).toBeGreaterThanOrEqual(1);
  });
});

describe("roundRobin protocol", () => {
  it("visits each agent in order and accumulates usage", async () => {
    const agents = [mkAgent("a"), mkAgent("b"), mkAgent("c")];
    const seen: string[] = [];
    const { ctx, events } = await makeCtx(
      { protocol: "round-robin", maxTurns: 3 },
      agents,
      scriptedSpawn(({ agent }) => {
        seen.push(agent.name);
        return `turn from ${agent.name}`;
      })
    );
    const res = await roundRobin(ctx);
    expect(res.status).toBe("completed");
    expect(seen).toEqual(["a", "b", "c"]);
    const usageEv = events.filter((e) => e.kind === "usage");
    expect(usageEv.length).toBe(3);
    expect(res.totals.inputTokens).toBe(30);
  });
});

describe("handoff protocol", () => {
  it("follows explicit HANDOFF directives until done", async () => {
    const agents = [mkAgent("alpha"), mkAgent("beta"), mkAgent("gamma")];
    const seen: string[] = [];
    const { ctx } = await makeCtx(
      { protocol: "handoff", maxTurns: 10 },
      agents,
      scriptedSpawn(({ agent }) => {
        seen.push(agent.name);
        if (agent.name === "alpha") return "kicking off\nHANDOFF: beta";
        if (agent.name === "beta") return "working\nHANDOFF: gamma";
        return "done\nHANDOFF: done";
      })
    );
    const res = await handoff(ctx);
    expect(res.status).toBe("completed");
    expect(seen).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("orchestrator protocol", () => {
  it("routes from lead to specialist and back", async () => {
    const agents = [mkAgent("lead", "plan"), mkAgent("worker", "code")];
    const seen: string[] = [];
    const { ctx } = await makeCtx(
      { protocol: "orchestrator", runtime: "custom", maxTurns: 8, orchestrator: "lead" },
      agents,
      scriptedSpawn(({ agent, turn }) => {
        seen.push(`${turn}:${agent.name}`);
        if (agent.name === "lead") {
          if (turn <= 1) return "need implementation\nROUTE: worker implement X";
          return "all good\nROUTE: done";
        }
        return "implemented it";
      })
    );
    const res = await orchestrator(ctx);
    expect(res.status).toBe("completed");
    expect(seen[0]).toContain(":lead");
    expect(seen.some((s) => s.endsWith(":worker"))).toBe(true);
  });
});

describe("parallel-fan-out protocol", () => {
  it("runs all agents then synthesises with the first", async () => {
    const agents = [mkAgent("p"), mkAgent("q"), mkAgent("r")];
    const seen: string[] = [];
    const { ctx } = await makeCtx(
      { protocol: "parallel-fan-out", runtime: "custom" },
      agents,
      scriptedSpawn(({ agent, turn }) => {
        seen.push(`${turn}:${agent.name}`);
        return `output from ${agent.name}`;
      })
    );
    const res = await makeParallelFanout({ maxConcurrent: 2 })(ctx);
    expect(res.status).toBe("completed");
    /* 3 fanout turns + 1 synthesize turn. */
    expect(seen.length).toBe(4);
    expect(seen[seen.length - 1]).toContain(":p");
  });
});

describe("debate protocol", () => {
  it("runs N rounds then judge emits decision.md", async () => {
    const agents = [mkAgent("prop"), mkAgent("con"), mkAgent("judge", "review")];
    const { ctx, runDir } = await makeCtx(
      { protocol: "debate", runtime: "custom", maxTurns: 2, judge: "judge" },
      agents,
      scriptedSpawn(({ agent }) => {
        if (agent.name === "judge") return "<decision>prop wins — go.</decision>";
        return `${agent.name} argues`;
      })
    );
    const res = await debate(ctx);
    expect(res.status).toBe("completed");
    const decision = await fs.readFile(path.join(runDir, "decision.md"), "utf8");
    expect(decision).toContain("prop wins");
    expect(res.planArtifactPath).toContain("decision.md");
  });
});

describe("plan-then-code protocol", () => {
  it("produces plan.md, awaits approval, then runs code phase", async () => {
    const agents = [mkAgent("pm", "plan"), mkAgent("arch", "plan"), mkAgent("dev", "code")];
    const { ctx, runDir } = await makeCtx(
      {
        protocol: "plan-then-code",
        runtime: "custom",
        agents: ["pm", "arch"],
        codePhaseAgents: ["dev"],
      },
      agents,
      scriptedSpawn(({ agent }) => {
        if (agent.name === "arch") return "<plan>1. implement\n2. test</plan>";
        if (agent.name === "pm") return "clarified";
        return "done coding";
      }),
      noopSession(),
      async () => ({ decision: "approve" })
    );
    const res = await planThenCode(ctx);
    expect(res.status).toBe("completed");
    const plan = await fs.readFile(path.join(runDir, "plan.md"), "utf8");
    expect(plan).toContain("implement");
    expect(res.planArtifactPath).toBe(path.join(runDir, "plan.md"));
  });

  it("aborts the code phase when the user rejects the plan", async () => {
    const agents = [mkAgent("pm", "plan"), mkAgent("dev", "code")];
    const { ctx, events } = await makeCtx(
      {
        protocol: "plan-then-code",
        runtime: "custom",
        agents: ["pm"],
        codePhaseAgents: ["dev"],
      },
      agents,
      scriptedSpawn(({ agent }) => {
        if (agent.name === "pm") return "<plan>rough plan</plan>";
        return "code (should never run)";
      }),
      noopSession(),
      async () => ({ decision: "reject", reason: "too risky" })
    );
    const res = await planThenCode(ctx);
    expect(res.status).toBe("aborted");
    const devStarts = events.filter((e) => e.kind === "agent_start" && (e as { agent: string }).agent === "dev");
    expect(devStarts.length).toBe(0);
  });
});
