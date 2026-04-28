/**
 * Incremental transcript tail for a single Claude session.
 *
 * Uses `fs.watch` when available, falling back to 2 s polling on throw (WSL,
 * network shares, FUSE). Tracks the byte offset per file; reads only the new
 * slice on each change and emits one `SessionPatch` per parsed JSONL line.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { parseTranscriptLine } from "./transcriptParser";
import type { SessionPatch } from "./sessionStore";

export type TranscriptWatcherOptions = {
  sessionId: string;
  filePath: string;
  onPatch: (patch: SessionPatch) => void;
  /** Initial read emits patches with `skipStatus: true`. */
  skipInitialStatus?: boolean;
  /** Poll interval for the fallback (ms). */
  pollIntervalMs?: number;
};

export class TranscriptWatcher {
  private watcher?: fs.FSWatcher;
  private pollTimer?: NodeJS.Timeout;
  private offset = 0;
  private buffer = "";
  private reading: Promise<void> = Promise.resolve();
  private disposed = false;
  private initialLoadPending = true;

  constructor(private readonly opts: TranscriptWatcherOptions) {}

  async start(): Promise<void> {
    /* Run initial backfill. */
    await this.readNewSlice(true);
    this.initialLoadPending = false;
    if (this.disposed) return;
    try {
      this.watcher = fs.watch(this.opts.filePath, { persistent: false }, () => {
        void this.readNewSlice(false);
      });
      this.watcher.on("error", () => this.startPollFallback());
    } catch {
      this.startPollFallback();
    }
  }

  private startPollFallback(): void {
    if (this.pollTimer || this.disposed) return;
    const interval = Math.max(250, this.opts.pollIntervalMs ?? 2000);
    this.pollTimer = setInterval(() => void this.readNewSlice(false), interval);
    this.pollTimer.unref?.();
  }

  private async readNewSlice(initial: boolean): Promise<void> {
    const task = this.reading.then(async () => {
      if (this.disposed) return;
      let stat: fs.Stats;
      try {
        stat = await fsp.stat(this.opts.filePath);
      } catch {
        return;
      }
      if (stat.size < this.offset) {
        /* File truncated or rotated — restart from 0. */
        this.offset = 0;
        this.buffer = "";
      }
      if (stat.size === this.offset) return;
      const fd = await fsp.open(this.opts.filePath, "r");
      try {
        const length = stat.size - this.offset;
        const buf = Buffer.alloc(length);
        await fd.read(buf, 0, length, this.offset);
        this.offset = stat.size;
        this.buffer += buf.toString("utf8");
      } finally {
        await fd.close();
      }
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      const skipStatus = this.opts.skipInitialStatus === true && initial;
      for (const line of lines) {
        const patch = parseTranscriptLine(line, {
          sessionId: this.opts.sessionId,
          skipStatus,
        });
        if (patch) {
          try {
            this.opts.onPatch(patch);
          } catch {
            /* subscriber error must not stop the watcher */
          }
        }
      }
    });
    this.reading = task.catch(() => {
      /* swallow — watcher remains alive */
    });
    return this.reading;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.watcher?.close();
    } catch {
      /* ignore */
    }
    if (this.pollTimer) clearInterval(this.pollTimer);
    await this.reading.catch(() => undefined);
  }

  /** Convenience: flush pending reads before teardown. */
  async flush(): Promise<void> {
    if (this.initialLoadPending) return;
    await this.readNewSlice(false);
  }
}
