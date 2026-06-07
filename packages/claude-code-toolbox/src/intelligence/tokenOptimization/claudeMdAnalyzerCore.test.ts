import { describe, it, expect } from "vitest";
import { analyzeClaudeMd, parseSections, formatAnalysisMarkdown } from "./claudeMdAnalyzerCore";

describe("claudeMdAnalyzerCore", () => {
  describe("parseSections", () => {
    it("parses headings into sections", () => {
      const content = "# Title\n\nIntro text\n\n## Section A\n\nContent A\n\n## Section B\n\nContent B";
      const sections = parseSections(content);
      expect(sections).toHaveLength(3);
      expect(sections[0].heading).toBe("Title");
      expect(sections[1].heading).toBe("Section A");
      expect(sections[2].heading).toBe("Section B");
    });

    it("handles single section", () => {
      const content = "# Only section\n\nSome text here.";
      const sections = parseSections(content);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe("Only section");
    });

    it("computes char count and token estimate", () => {
      const content = "# Heading\n\n" + "x".repeat(400);
      const sections = parseSections(content);
      expect(sections[0].charCount).toBeGreaterThan(400);
      expect(sections[0].tokenEstimate).toBe(Math.ceil(sections[0].charCount / 4));
    });
  });

  describe("analyzeClaudeMd", () => {
    it("detects oversized sections", () => {
      const bigSection = "# Big\n\n" + "word ".repeat(600);
      const result = analyzeClaudeMd(bigSection);
      expect(result.oversizedSections.length).toBeGreaterThan(0);
    });

    it("detects duplicate content", () => {
      const words = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega";
      const content = `# Section A\n\n${words}\n\n# Section B\n\n${words}`;
      const result = analyzeClaudeMd(content);
      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].overlapPercent).toBeGreaterThan(80);
    });

    it("reports healthy file", () => {
      const content = "# Project\n\nShort instructions.";
      const result = analyzeClaudeMd(content);
      expect(result.recommendations).toContain("CLAUDE.md looks healthy. No optimization needed.");
    });

    it("warns about large total token count", () => {
      const content = "# Big file\n\n" + "x ".repeat(7000);
      const result = analyzeClaudeMd(content);
      expect(result.recommendations.some((r) => r.includes("consider keeping under"))).toBe(true);
    });
  });

  describe("formatAnalysisMarkdown", () => {
    it("produces readable markdown report", () => {
      const result = analyzeClaudeMd("# Test\n\nContent here.\n\n## Other\n\nMore content.");
      const md = formatAnalysisMarkdown(result);
      expect(md).toContain("# CLAUDE.md Token Analysis");
      expect(md).toContain("Section breakdown");
      expect(md).toContain("Recommendations");
    });
  });
});
