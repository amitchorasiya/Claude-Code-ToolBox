import { describe, expect, it } from "vitest";
import {
  buildMcpSkillsAwarenessInstructionsBlock,
  MCP_SKILLS_AWARENESS_BANNER_END,
  MCP_SKILLS_AWARENESS_BANNER_START,
  replaceOrAppendAwarenessBlock,
} from "./mergeMcpSkillsIntoClaudeMdCore";

describe("replaceOrAppendAwarenessBlock", () => {
  it("creates a minimal file when existing is empty", () => {
    const block = buildMcpSkillsAwarenessInstructionsBlock("Hello");
    const next = replaceOrAppendAwarenessBlock("", block);
    expect(next).toContain("# Claude Code — project context");
    expect(next).toContain(MCP_SKILLS_AWARENESS_BANNER_START);
    expect(next).toContain("Hello");
    expect(next).toContain(MCP_SKILLS_AWARENESS_BANNER_END);
  });

  it("replaces an existing marked block", () => {
    const inner1 = buildMcpSkillsAwarenessInstructionsBlock("v1");
    const base = `# Title\n\n${inner1}\n\nTail`;
    const inner2 = buildMcpSkillsAwarenessInstructionsBlock("v2");
    const next = replaceOrAppendAwarenessBlock(base, inner2);
    expect(next).toContain("v2");
    expect(next).not.toContain("v1");
    expect(next).toContain("Tail");
  });

  it("appends when no markers exist", () => {
    const existing = "# Claude Code — project context\n\nCustom body.\n";
    const block = buildMcpSkillsAwarenessInstructionsBlock("New");
    const next = replaceOrAppendAwarenessBlock(existing, block);
    expect(next).toContain("Custom body.");
    expect(next).toContain("New");
  });
});
