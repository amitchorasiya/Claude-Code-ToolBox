import { describe, it, expect } from "vitest";
import {
  checkReadRedundancy,
  recordFileRead,
  pruneStaleRecords,
  DEFAULT_DEDUP_CONFIG,
  type FileReadRecord,
} from "./readDeduplicationCore";

describe("readDeduplicationCore", () => {
  describe("checkReadRedundancy", () => {
    it("returns not redundant for first read", () => {
      const records = new Map<string, FileReadRecord>();
      const result = checkReadRedundancy(
        "/src/foo.ts", 1000, 500, records, DEFAULT_DEDUP_CONFIG, Date.now()
      );
      expect(result.isRedundant).toBe(false);
    });

    it("returns redundant for same file within window", () => {
      const records = new Map<string, FileReadRecord>();
      const now = Date.now();
      recordFileRead("/src/foo.ts", 1000, 500, records, now);
      recordFileRead("/src/foo.ts", 1000, 500, records, now + 1000);

      const result = checkReadRedundancy(
        "/src/foo.ts", 1000, 500, records, DEFAULT_DEDUP_CONFIG, now + 2000
      );
      expect(result.isRedundant).toBe(true);
      expect(result.message).toContain("unchanged");
    });

    it("returns not redundant if file changed (different mtime)", () => {
      const records = new Map<string, FileReadRecord>();
      const now = Date.now();
      recordFileRead("/src/foo.ts", 1000, 500, records, now);
      recordFileRead("/src/foo.ts", 1000, 500, records, now + 1000);

      const result = checkReadRedundancy(
        "/src/foo.ts", 2000, 500, records, DEFAULT_DEDUP_CONFIG, now + 2000
      );
      expect(result.isRedundant).toBe(false);
    });

    it("returns not redundant if outside window", () => {
      const records = new Map<string, FileReadRecord>();
      const now = Date.now();
      recordFileRead("/src/foo.ts", 1000, 500, records, now);
      recordFileRead("/src/foo.ts", 1000, 500, records, now + 1000);

      const result = checkReadRedundancy(
        "/src/foo.ts", 1000, 500, records, DEFAULT_DEDUP_CONFIG, now + 400_000
      );
      expect(result.isRedundant).toBe(false);
    });

    it("allows always-allowed patterns", () => {
      const records = new Map<string, FileReadRecord>();
      const now = Date.now();
      recordFileRead("CLAUDE.md", 1000, 500, records, now);
      recordFileRead("CLAUDE.md", 1000, 500, records, now + 1000);

      const result = checkReadRedundancy(
        "CLAUDE.md", 1000, 500, records, DEFAULT_DEDUP_CONFIG, now + 2000
      );
      expect(result.isRedundant).toBe(false);
    });
  });

  describe("pruneStaleRecords", () => {
    it("removes records older than maxAge", () => {
      const records = new Map<string, FileReadRecord>();
      const now = Date.now();
      recordFileRead("/old.ts", 100, 50, records, now - 600_000);
      recordFileRead("/new.ts", 200, 100, records, now - 1000);

      pruneStaleRecords(records, 300_000, now);
      expect(records.has("/old.ts")).toBe(false);
      expect(records.has("/new.ts")).toBe(true);
    });
  });
});
