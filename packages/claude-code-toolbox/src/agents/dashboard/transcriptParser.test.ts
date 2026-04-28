import { describe, expect, it } from "vitest";
import { isHumanUserTurn, parseTranscriptLine } from "./transcriptParser";

const ctx = { sessionId: "S1" };

describe("isHumanUserTurn", () => {
  it("treats a string as a human turn", () => {
    expect(isHumanUserTurn("hi")).toBe(true);
  });
  it("treats an array with text block as human", () => {
    expect(isHumanUserTurn([{ type: "text", text: "hi" }])).toBe(true);
  });
  it("does not treat tool_result as human", () => {
    expect(isHumanUserTurn([{ type: "tool_result", tool_use_id: "t1" }])).toBe(false);
  });
  it("mixed text+tool_result is not human", () => {
    expect(
      isHumanUserTurn([
        { type: "text", text: "ok" },
        { type: "tool_result", tool_use_id: "t2" },
      ])
    ).toBe(false);
  });
});

describe("parseTranscriptLine", () => {
  it("returns undefined for malformed lines", () => {
    expect(parseTranscriptLine("not json", ctx)).toBeUndefined();
    expect(parseTranscriptLine("", ctx)).toBeUndefined();
  });

  it("recognises stop_hook_summary as done", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({ type: "system", subtype: "stop_hook_summary" }),
      ctx
    );
    expect(patch?.status).toBe("done");
  });

  it("compact_boundary resets context", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({ type: "system", subtype: "compact_boundary" }),
      ctx
    );
    expect(patch?.context?.used).toBe(0);
  });

  it("human user turn seeds title and sets thinking", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({
        type: "user",
        message: { content: "Read package.json and summarize" },
      }),
      ctx
    );
    expect(patch?.status).toBe("thinking");
    expect(patch?.title).toContain("Read package.json");
  });

  it("assistant tool_use sets running + current tool + adds to feed", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Read", input: { file_path: "pkg.json" } },
          ],
          usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000 },
        },
      }),
      ctx
    );
    expect(patch?.status).toBe("running");
    expect(patch?.currentTool?.name).toBe("Read");
    expect(patch?.currentTool?.target).toBe("pkg.json");
    expect(patch?.toolFeed?.length).toBe(1);
    expect(patch?.tokens?.input).toBe(100);
    expect(patch?.context?.used).toBe(1100);
  });

  it("tool-result user turn only clears the current tool", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
      }),
      ctx
    );
    expect(patch?.status).toBeUndefined();
    expect(patch?.currentTool).toBeUndefined();
  });

  it("skipStatus suppresses status changes while still accumulating usage", () => {
    const patch = parseTranscriptLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "hi" }],
          usage: { input_tokens: 50 },
        },
      }),
      { sessionId: "S1", skipStatus: true }
    );
    expect(patch?.status).toBeUndefined();
    expect(patch?.tokens?.input).toBe(50);
  });
});
