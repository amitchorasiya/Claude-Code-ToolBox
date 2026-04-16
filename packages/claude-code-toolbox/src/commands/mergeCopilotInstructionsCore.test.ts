import { describe, expect, it } from "vitest";
import {
  COPILOT_INSTRUCTIONS_MIGRATE_BEGIN,
  COPILOT_INSTRUCTIONS_MIGRATE_END,
  mergeCopilotInstructionsIntoClaudeMdContent,
} from "./mergeCopilotInstructionsCore";

describe("mergeCopilotInstructionsIntoClaudeMdContent", () => {
  it("creates minimal CLAUDE.md when empty", () => {
    const next = mergeCopilotInstructionsIntoClaudeMdContent("", "Hello copilot");
    expect(next).toContain("# Claude Code — project context");
    expect(next).toContain(COPILOT_INSTRUCTIONS_MIGRATE_BEGIN);
    expect(next).toContain("Hello copilot");
    expect(next).toContain(COPILOT_INSTRUCTIONS_MIGRATE_END);
  });

  it("replaces an existing marked block", () => {
    const inner1 = mergeCopilotInstructionsIntoClaudeMdContent("", "v1");
    const inner2 = mergeCopilotInstructionsIntoClaudeMdContent(inner1, "v2");
    expect(inner2).toContain("v2");
    expect(inner2).not.toContain("v1");
  });

  it("appends when no markers exist", () => {
    const existing = "# Claude Code — project context\n\nCustom.\n";
    const next = mergeCopilotInstructionsIntoClaudeMdContent(existing, "From copilot");
    expect(next).toContain("Custom.");
    expect(next).toContain("From copilot");
  });
});
