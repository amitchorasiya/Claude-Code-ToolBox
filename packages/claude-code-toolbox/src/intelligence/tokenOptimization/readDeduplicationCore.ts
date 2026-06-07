/**
 * Read deduplication: tracks file reads, detects redundant re-reads within a time window.
 * Pure logic — no vscode imports.
 */

export type FileReadRecord = {
  path: string;
  mtime: number;
  size: number;
  lastReadAt: number;
  readCount: number;
};

export type DeduplicationConfig = {
  windowMs: number;
  maxReReadsBeforeWarn: number;
  allowAlwaysPatterns: string[];
};

export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  windowMs: 300_000,
  maxReReadsBeforeWarn: 1,
  allowAlwaysPatterns: ["CLAUDE.md", ".claude/project-map.md", "package.json"],
};

export type DeduplicationResult = {
  isRedundant: boolean;
  message: string;
  lastReadSecondsAgo: number;
  readCount: number;
};

export function checkReadRedundancy(
  path: string,
  currentMtime: number,
  currentSize: number,
  records: Map<string, FileReadRecord>,
  config: DeduplicationConfig,
  now: number
): DeduplicationResult {
  for (const pattern of config.allowAlwaysPatterns) {
    if (path.endsWith(pattern) || path.includes(pattern)) {
      return { isRedundant: false, message: "", lastReadSecondsAgo: 0, readCount: 0 };
    }
  }

  const record = records.get(path);
  if (!record) {
    return { isRedundant: false, message: "", lastReadSecondsAgo: 0, readCount: 0 };
  }

  const elapsed = now - record.lastReadAt;
  if (elapsed > config.windowMs) {
    return { isRedundant: false, message: "", lastReadSecondsAgo: Math.round(elapsed / 1000), readCount: record.readCount };
  }

  const hashUnchanged = record.mtime === currentMtime && record.size === currentSize;
  if (!hashUnchanged) {
    return { isRedundant: false, message: "", lastReadSecondsAgo: Math.round(elapsed / 1000), readCount: record.readCount };
  }

  if (record.readCount < config.maxReReadsBeforeWarn) {
    return { isRedundant: false, message: "", lastReadSecondsAgo: Math.round(elapsed / 1000), readCount: record.readCount };
  }

  const secondsAgo = Math.round(elapsed / 1000);
  return {
    isRedundant: true,
    message: `File unchanged since last read ${secondsAgo}s ago (read ${record.readCount} time(s) this session). Consider using cached content.`,
    lastReadSecondsAgo: secondsAgo,
    readCount: record.readCount,
  };
}

export function recordFileRead(
  path: string,
  mtime: number,
  size: number,
  records: Map<string, FileReadRecord>,
  now: number
): void {
  const existing = records.get(path);
  if (existing) {
    existing.mtime = mtime;
    existing.size = size;
    existing.lastReadAt = now;
    existing.readCount++;
  } else {
    records.set(path, { path, mtime, size, lastReadAt: now, readCount: 1 });
  }
}

export function pruneStaleRecords(
  records: Map<string, FileReadRecord>,
  maxAgeMs: number,
  now: number
): void {
  for (const [key, record] of records) {
    if (now - record.lastReadAt > maxAgeMs) {
      records.delete(key);
    }
  }
}
