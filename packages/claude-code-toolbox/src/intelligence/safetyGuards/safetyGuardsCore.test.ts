import { describe, it, expect } from "vitest";
import {
  DEFAULT_DESTRUCTIVE_PATTERNS,
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_BLOCKED_DOMAINS,
} from "./safetyGuardsCore";

describe("safetyGuardsCore", () => {
  it("has non-empty default destructive patterns", () => {
    expect(DEFAULT_DESTRUCTIVE_PATTERNS.length).toBeGreaterThan(10);
  });

  it("has non-empty default allowed domains", () => {
    expect(DEFAULT_ALLOWED_DOMAINS.length).toBeGreaterThan(5);
  });

  it("has non-empty default blocked domains", () => {
    expect(DEFAULT_BLOCKED_DOMAINS.length).toBeGreaterThan(0);
  });

  it("default destructive patterns are all lowercase-safe strings", () => {
    for (const p of DEFAULT_DESTRUCTIVE_PATTERNS) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it("default domains contain no protocol prefixes", () => {
    for (const d of [...DEFAULT_ALLOWED_DOMAINS, ...DEFAULT_BLOCKED_DOMAINS]) {
      expect(d).not.toMatch(/^https?:\/\//);
    }
  });
});
