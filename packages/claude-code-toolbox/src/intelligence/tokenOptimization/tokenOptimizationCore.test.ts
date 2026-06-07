import { describe, it, expect } from "vitest";
import {
  buildVerbosityInstructions,
  buildTokenOptimizationBlock,
  estimateTokens,
} from "./tokenOptimizationCore";

describe("tokenOptimizationCore", () => {
  describe("buildVerbosityInstructions", () => {
    it("returns empty for normal level", () => {
      expect(buildVerbosityInstructions("normal")).toBe("");
    });

    it("returns concise instructions", () => {
      const result = buildVerbosityInstructions("concise");
      expect(result).toContain("1-3 sentences");
      expect(result).toContain("Never restate");
    });

    it("returns minimal instructions", () => {
      const result = buildVerbosityInstructions("minimal");
      expect(result).toContain("bullets only");
      expect(result).toContain("No meta-commentary");
    });

    it("returns json-only instructions", () => {
      const result = buildVerbosityInstructions("json-only");
      expect(result).toContain("valid JSON");
      expect(result).toContain("No English prose");
    });
  });

  describe("buildTokenOptimizationBlock", () => {
    it("includes verbosity level", () => {
      const block = buildTokenOptimizationBlock({
        verbosityLevel: "concise",
        projectMapEnabled: true,
        claudeIgnoreEnabled: true,
        readDedupEnabled: true,
      });
      expect(block).toContain("_Active level: concise_");
    });

    it("includes project map reference when enabled", () => {
      const block = buildTokenOptimizationBlock({
        verbosityLevel: "concise",
        projectMapEnabled: true,
        claudeIgnoreEnabled: false,
        readDedupEnabled: false,
      });
      expect(block).toContain("project-map.md");
    });

    it("includes claudeignore reference when enabled", () => {
      const block = buildTokenOptimizationBlock({
        verbosityLevel: "minimal",
        projectMapEnabled: false,
        claudeIgnoreEnabled: true,
        readDedupEnabled: false,
      });
      expect(block).toContain(".claudeignore");
    });

    it("excludes project map when disabled", () => {
      const block = buildTokenOptimizationBlock({
        verbosityLevel: "concise",
        projectMapEnabled: false,
        claudeIgnoreEnabled: false,
        readDedupEnabled: false,
      });
      expect(block).not.toContain("project-map.md");
    });
  });

  describe("estimateTokens", () => {
    it("estimates tokens as chars/4", () => {
      expect(estimateTokens("hello world!")).toBe(3);
    });

    it("handles empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });
  });
});
