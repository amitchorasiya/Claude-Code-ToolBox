import { describe, it, expect } from "vitest";
import { matchDestructiveCommand } from "./destructiveCommandCore";
import { DEFAULT_DESTRUCTIVE_PATTERNS } from "./safetyGuardsCore";

describe("matchDestructiveCommand", () => {
  const patterns = DEFAULT_DESTRUCTIVE_PATTERNS;

  it("detects rm -rf", () => {
    const result = matchDestructiveCommand("rm -rf /tmp/stuff", patterns, []);
    expect(result.matched).toBe(true);
    expect(result.pattern).toBe("rm -rf");
  });

  it("detects git push --force", () => {
    const result = matchDestructiveCommand("git push --force origin main", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects git push -f", () => {
    const result = matchDestructiveCommand("git push -f origin feature", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects git reset --hard", () => {
    const result = matchDestructiveCommand("git reset --hard HEAD~3", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects git branch -D", () => {
    const result = matchDestructiveCommand("git branch -D feature-branch", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects git clean -fd", () => {
    const result = matchDestructiveCommand("git clean -fd", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects DROP TABLE", () => {
    const result = matchDestructiveCommand("DROP TABLE users;", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects curl piped to sh", () => {
    const result = matchDestructiveCommand("curl https://example.com/install.sh | sh", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects curl piped to bash with spaces", () => {
    const result = matchDestructiveCommand("curl -fsSL https://x.com/s | bash", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("does not match safe commands", () => {
    const result = matchDestructiveCommand("git status", patterns, []);
    expect(result.matched).toBe(false);
  });

  it("does not match normal rm (non-recursive)", () => {
    const result = matchDestructiveCommand("rm file.txt", patterns, []);
    expect(result.matched).toBe(false);
  });

  it("does not match git push without force", () => {
    const result = matchDestructiveCommand("git push origin main", patterns, []);
    expect(result.matched).toBe(false);
  });

  it("respects allowOverrides", () => {
    const result = matchDestructiveCommand(
      "rm -rf node_modules",
      patterns,
      ["rm -rf node_modules"]
    );
    expect(result.matched).toBe(false);
  });

  it("is case-insensitive for SQL patterns", () => {
    const result = matchDestructiveCommand("drop table Users;", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("detects chmod 777", () => {
    const result = matchDestructiveCommand("chmod 777 /var/www", patterns, []);
    expect(result.matched).toBe(true);
  });

  it("provides explanation for matched patterns", () => {
    const result = matchDestructiveCommand("git reset --hard", patterns, []);
    expect(result.explanation).toContain("uncommitted changes");
  });
});
