import { describe, it, expect } from "vitest";
import {
  buildTokenOptInstructionsBlock,
  replaceOrAppendTokenOptBlock,
  removeTokenOptBlock,
  TOKEN_OPT_BANNER_START,
  TOKEN_OPT_BANNER_END,
} from "./mergeTokenOptIntoClaudeMdCore";

describe("mergeTokenOptIntoClaudeMdCore", () => {
  describe("buildTokenOptInstructionsBlock", () => {
    it("wraps content with banners", () => {
      const block = buildTokenOptInstructionsBlock("test content");
      expect(block).toContain(TOKEN_OPT_BANNER_START);
      expect(block).toContain(TOKEN_OPT_BANNER_END);
      expect(block).toContain("test content");
    });
  });

  describe("replaceOrAppendTokenOptBlock", () => {
    it("creates new file with header when empty", () => {
      const result = replaceOrAppendTokenOptBlock("", buildTokenOptInstructionsBlock("hello"));
      expect(result).toContain("# Claude Code");
      expect(result).toContain("hello");
    });

    it("appends to existing content without markers", () => {
      const existing = "# My Project\n\nSome content.";
      const block = buildTokenOptInstructionsBlock("new block");
      const result = replaceOrAppendTokenOptBlock(existing, block);
      expect(result).toContain("# My Project");
      expect(result).toContain("new block");
    });

    it("replaces existing block", () => {
      const existing = `# My Project\n\n${TOKEN_OPT_BANNER_START}\nold content\n${TOKEN_OPT_BANNER_END}\n\nOther content.`;
      const block = buildTokenOptInstructionsBlock("new content");
      const result = replaceOrAppendTokenOptBlock(existing, block);
      expect(result).toContain("new content");
      expect(result).not.toContain("old content");
      expect(result).toContain("Other content.");
    });
  });

  describe("removeTokenOptBlock", () => {
    it("removes the block cleanly", () => {
      const existing = `# My Project\n\n${TOKEN_OPT_BANNER_START}\nstuff\n${TOKEN_OPT_BANNER_END}\n\nKeep this.`;
      const result = removeTokenOptBlock(existing);
      expect(result).not.toContain(TOKEN_OPT_BANNER_START);
      expect(result).not.toContain("stuff");
      expect(result).toContain("Keep this.");
    });

    it("returns unchanged if no block present", () => {
      const existing = "# My Project\n\nNo markers here.";
      const result = removeTokenOptBlock(existing);
      expect(result).toBe(existing.trim());
    });
  });
});
