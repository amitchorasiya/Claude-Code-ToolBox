import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { RunBus } from "./runBus";
import type { AgentRunEvent } from "./eventTypes";

function mkEvent(kind: AgentRunEvent["kind"], partial: Partial<AgentRunEvent> = {}): AgentRunEvent {
  const base = { t: new Date().toISOString(), runId: "r1", ...partial } as Record<string, unknown>;
  base.kind = kind;
  return base as AgentRunEvent;
}

describe("RunBus", () => {
  it("fans events to subscribers and appends them as JSON lines", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-bus-"));
    const jsonl = path.join(tmp, "r.jsonl");
    const bus = new RunBus("r1", jsonl);
    const got: string[] = [];
    bus.on((ev) => got.push(ev.kind));
    bus.emit(mkEvent("run_start", { teamId: "t", teamName: "t", protocol: "native-task", runtime: "native", phase: "none" } as Partial<AgentRunEvent>));
    bus.emit(
      mkEvent("assistant_delta", { agent: "backend-dev", text: "hi" } as Partial<AgentRunEvent>)
    );
    bus.emit(mkEvent("run_end", { status: "completed", totals: { inputTokens: 0, outputTokens: 0, costUsd: 0 } } as Partial<AgentRunEvent>));
    await bus.flush();
    expect(got).toEqual(["run_start", "assistant_delta", "run_end"]);
    const text = await fs.readFile(jsonl, "utf8");
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(3);
    for (const line of lines) {
      JSON.parse(line); /* throws on malformed */
    }
  });

  it("drops non-run_end events emitted after run_end", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-bus-"));
    const bus = new RunBus("r2", path.join(tmp, "r.jsonl"));
    const got: string[] = [];
    bus.on((ev) => got.push(ev.kind));
    bus.emit(mkEvent("run_end", { status: "completed", totals: { inputTokens: 0, outputTokens: 0, costUsd: 0 } } as Partial<AgentRunEvent>));
    bus.emit(mkEvent("assistant_delta", { agent: "x", text: "late" } as Partial<AgentRunEvent>));
    await bus.flush();
    expect(got).toEqual(["run_end"]);
  });
});
