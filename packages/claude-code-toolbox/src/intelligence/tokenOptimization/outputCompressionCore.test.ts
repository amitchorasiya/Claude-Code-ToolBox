import { describe, it, expect } from "vitest";
import { compressOutput, compressGeneric, DEFAULT_COMPRESSION_CONFIG } from "./outputCompressionCore";

describe("outputCompressionCore", () => {
  describe("compressOutput", () => {
    it("returns unchanged if under maxLines", () => {
      const output = "line1\nline2\nline3";
      const result = compressOutput("echo hello", output, DEFAULT_COMPRESSION_CONFIG);
      expect(result.compressed).toBe(output);
      expect(result.savingsPercent).toBe(0);
    });

    it("compresses git diff output", () => {
      const lines = [
        "diff --git a/foo.ts b/foo.ts",
        "--- a/foo.ts",
        "+++ b/foo.ts",
        "+new line",
        "-old line",
        "diff --git a/bar.ts b/bar.ts",
        "--- a/bar.ts",
        "+++ b/bar.ts",
        "+another",
      ];
      const bigOutput = lines.join("\n") + "\n" + Array(60).fill("context line").join("\n");
      const result = compressOutput("git diff", bigOutput, { ...DEFAULT_COMPRESSION_CONFIG, maxLines: 10 });
      expect(result.compressedLines).toBeLessThan(result.originalLines);
      expect(result.compressed).toContain("Files changed");
    });

    it("compresses git status output", () => {
      const statusLines = [
        "On branch main",
        "Your branch is up to date with 'origin/main'.",
        "",
        "Changes not staged for commit:",
        "  (use \"git add <file>...\" to update what will be committed)",
        "",
        ...Array(60).fill("  modified:   some-file.ts"),
      ];
      const result = compressOutput("git status", statusLines.join("\n"), { ...DEFAULT_COMPRESSION_CONFIG, maxLines: 10 });
      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe("compressGeneric", () => {
    it("deduplicates repeated lines", () => {
      const lines = Array(20).fill("repeated warning message");
      const result = compressGeneric(lines, 10);
      expect(result).toContain("(x20)");
      expect(result.split("\n").length).toBeLessThan(20);
    });

    it("truncates with count when too long", () => {
      const lines = Array(100).fill(0).map((_, i) => `unique line ${i}`);
      const result = compressGeneric(lines, 20);
      expect(result).toContain("lines omitted");
    });
  });
});
