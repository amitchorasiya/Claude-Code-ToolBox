import { describe, expect, it } from "vitest";
import { classifyPromptIntent } from "./smartRouter";

describe("classifyPromptIntent", () => {
  it("picks plan for planning prompts", () => {
    expect(classifyPromptIntent("Plan a new import pipeline")).toBe("plan");
    expect(classifyPromptIntent("Design the SDLC")).toBe("plan");
    expect(classifyPromptIntent("Break down this RFC")).toBe("plan");
  });
  it("picks debate for trade-off prompts", () => {
    expect(classifyPromptIntent("Compare postgres vs sqlite for this?")).toBe("debate");
    expect(classifyPromptIntent("Pros and cons of server components")).toBe("debate");
    expect(classifyPromptIntent("Which option should we ship?")).toBe("debate");
  });
  it("falls back to single for short utility prompts", () => {
    expect(classifyPromptIntent("Rename foo to bar in this file")).toBe("single");
  });
});
