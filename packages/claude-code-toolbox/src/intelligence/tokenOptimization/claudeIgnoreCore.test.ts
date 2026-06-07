import { describe, it, expect } from "vitest";
import {
  parseClaudeIgnore,
  matchesClaudeIgnore,
  DEFAULT_CLAUDEIGNORE_PATTERNS,
} from "./claudeIgnoreCore";

describe("claudeIgnoreCore", () => {
  describe("parseClaudeIgnore", () => {
    it("parses patterns, skipping comments and empty lines", () => {
      const content = "# comment\n\n**/node_modules/**\n**/*.lock\n";
      const result = parseClaudeIgnore(content);
      expect(result).toEqual(["**/node_modules/**", "**/*.lock"]);
    });
  });

  describe("matchesClaudeIgnore", () => {
    it("matches node_modules paths", () => {
      expect(matchesClaudeIgnore("node_modules/foo/bar.js", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
      expect(matchesClaudeIgnore("src/node_modules/pkg/index.js", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
    });

    it("matches lock files", () => {
      expect(matchesClaudeIgnore("package-lock.json", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
      expect(matchesClaudeIgnore("yarn.lock", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
    });

    it("matches dist/build directories", () => {
      expect(matchesClaudeIgnore("dist/bundle.js", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
      expect(matchesClaudeIgnore("build/output.css", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
    });

    it("matches minified files", () => {
      expect(matchesClaudeIgnore("vendor/jquery.min.js", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
    });

    it("matches source maps", () => {
      expect(matchesClaudeIgnore("src/app.js.map", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(true);
    });

    it("does not match source files", () => {
      expect(matchesClaudeIgnore("src/index.ts", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(false);
      expect(matchesClaudeIgnore("lib/utils.py", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(false);
    });

    it("does not match config files", () => {
      expect(matchesClaudeIgnore("package.json", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(false);
      expect(matchesClaudeIgnore("tsconfig.json", DEFAULT_CLAUDEIGNORE_PATTERNS)).toBe(false);
    });
  });
});
