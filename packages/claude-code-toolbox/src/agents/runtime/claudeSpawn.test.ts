import { describe, expect, it } from "vitest";
import { parseStreamJsonLine } from "./claudeSpawn";

describe("parseStreamJsonLine", () => {
  const ctx = { runId: "r1", agent: "backend-dev", phase: "none" as const };

  it("parses assistant text blocks as assistant_delta", () => {
    const events = parseStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "hello" }] },
      }),
      ctx
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("assistant_delta");
    if (events[0].kind === "assistant_delta") {
      expect(events[0].text).toBe("hello");
    }
  });

  it("parses tool_use and surfaces Task calls as agent_start", () => {
    const events = parseStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Task",
              input: { subagent_type: "reviewer", prompt: "review diff" },
            },
          ],
        },
      }),
      ctx
    );
    expect(events.map((e) => e.kind)).toEqual(["tool_use", "agent_start"]);
    if (events[1].kind === "agent_start") {
      expect(events[1].agent).toBe("reviewer");
    }
  });

  it("parses tool_result messages", () => {
    const events = parseStreamJsonLine(
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "t1",
              is_error: false,
              content: "ok",
            },
          ],
        },
      }),
      ctx
    );
    expect(events[0].kind).toBe("tool_result");
    if (events[0].kind === "tool_result") {
      expect(events[0].ok).toBe(true);
    }
  });

  it("parses result messages as usage + log/error", () => {
    const events = parseStreamJsonLine(
      JSON.stringify({
        type: "result",
        subtype: "success",
        usage: { input_tokens: 100, output_tokens: 50 },
        total_cost_usd: 0.01,
      }),
      ctx
    );
    expect(events.map((e) => e.kind)).toContain("usage");
    const usageEv = events.find((e) => e.kind === "usage");
    if (usageEv && usageEv.kind === "usage") {
      expect(usageEv.usage.inputTokens).toBe(100);
      expect(usageEv.usage.costUsd).toBe(0.01);
    }
  });

  it("handles malformed JSON without throwing", () => {
    const events = parseStreamJsonLine("{not json", ctx);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("log");
  });

  it("skips empty lines", () => {
    expect(parseStreamJsonLine("", ctx)).toEqual([]);
    expect(parseStreamJsonLine("   ", ctx)).toEqual([]);
  });
});
