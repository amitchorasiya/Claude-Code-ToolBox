import { describe, expect, it } from "vitest";
import { evaluateReadiness, formatReadinessMarkdown } from "./readiness";

const emptyCopilot = { exists: false, byteLength: 0 };

describe("evaluateReadiness", () => {
  it("flags missing CLAUDE.md", () => {
    const checks = evaluateReadiness({
      claudeMd: { exists: false, byteLength: 0 },
      claudeMdHasCopilotMigrateBlock: false,
      agentsMd: { exists: false, byteLength: 0 },
      claudeRulesFileCount: 0,
      memoryBankDirExists: false,
      workspaceMcpJson: { exists: false, byteLength: 0 },
      cursorrules: { exists: false, byteLength: 0 },
      cursorRulesDirHasFiles: false,
      copilotInstructionsMd: emptyCopilot,
    });
    const ci = checks.find((c) => c.id === "claude-md");
    expect(ci?.ok).toBe(false);
    expect(ci?.suggestedCommand).toBe("CloudeCodeToolBox.runOneClickSetup");
  });

  it("adds mtime check when both rules exist", () => {
    const checks = evaluateReadiness({
      claudeMd: { exists: true, byteLength: 100, mtimeMs: 1000 },
      claudeMdHasCopilotMigrateBlock: false,
      agentsMd: { exists: true, byteLength: 10 },
      claudeRulesFileCount: 1,
      memoryBankDirExists: true,
      workspaceMcpJson: { exists: true, byteLength: 5 },
      cursorrules: { exists: true, byteLength: 20, mtimeMs: 2000 },
      cursorRulesDirHasFiles: false,
      copilotInstructionsMd: emptyCopilot,
    });
    expect(checks.some((c) => c.id === "cursorrules-mtime")).toBe(true);
  });

  it("flags legacy copilot instructions not merged into CLAUDE.md", () => {
    const checks = evaluateReadiness({
      claudeMd: { exists: true, byteLength: 200 },
      claudeMdHasCopilotMigrateBlock: false,
      agentsMd: { exists: false, byteLength: 0 },
      claudeRulesFileCount: 0,
      memoryBankDirExists: false,
      workspaceMcpJson: { exists: false, byteLength: 0 },
      cursorrules: { exists: false, byteLength: 0 },
      cursorRulesDirHasFiles: false,
      copilotInstructionsMd: { exists: true, byteLength: 100 },
    });
    const leg = checks.find((c) => c.id === "copilot-instructions-legacy");
    expect(leg?.ok).toBe(false);
    expect(leg?.suggestedCommand).toBe("CloudeCodeToolBox.mergeCopilotInstructionsIntoClaudeMd");
  });

  it("passes copilot legacy check when migrate marker present", () => {
    const checks = evaluateReadiness({
      claudeMd: { exists: true, byteLength: 200 },
      claudeMdHasCopilotMigrateBlock: true,
      agentsMd: { exists: false, byteLength: 0 },
      claudeRulesFileCount: 0,
      memoryBankDirExists: false,
      workspaceMcpJson: { exists: false, byteLength: 0 },
      cursorrules: { exists: false, byteLength: 0 },
      cursorRulesDirHasFiles: false,
      copilotInstructionsMd: { exists: true, byteLength: 100 },
    });
    const leg = checks.find((c) => c.id === "copilot-instructions-legacy");
    expect(leg?.ok).toBe(true);
  });
});

describe("formatReadinessMarkdown", () => {
  it("renders headings", () => {
    const md = formatReadinessMarkdown([
      { id: "x", ok: true, message: "ok", suggestedCommand: "CloudeCodeToolBox.foo" },
    ]);
    expect(md).toContain("Intelligence readiness");
    expect(md).toContain("CloudeCodeToolBox.foo");
  });
});
