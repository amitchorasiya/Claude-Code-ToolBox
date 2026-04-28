/**
 * Per-run event bus: an EventEmitter that also appends every event to
 * a durable JSONL transcript under `.claude/runs/`.
 *
 * The bus is the single source of truth for both the live webview stream and
 * the on-disk transcript — if they disagree, the JSONL wins (it's flushed
 * synchronously on every emit via a write queue).
 */
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentRunEvent } from "./eventTypes";

export type RunBusListener = (event: AgentRunEvent) => void;

export class RunBus {
  private readonly emitter = new EventEmitter();
  private writeQueue: Promise<void> = Promise.resolve();
  private ended = false;

  constructor(
    public readonly runId: string,
    public readonly jsonlPath: string
  ) {
    this.emitter.setMaxListeners(32);
  }

  on(listener: RunBusListener): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  emit(event: AgentRunEvent): void {
    if (this.ended && event.kind !== "run_end") {
      return;
    }
    if (event.kind === "run_end") {
      this.ended = true;
    }
    this.emitter.emit("event", event);
    this.writeQueue = this.writeQueue.then(() => this.appendJsonLine(event)).catch(() => {
      /* writer errors are surfaced through a subsequent `log` event; never throw from emit. */
    });
  }

  /** Wait for all pending JSONL writes to flush. */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private async appendJsonLine(event: AgentRunEvent): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.jsonlPath), { recursive: true });
      await fs.appendFile(this.jsonlPath, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      /* swallow; transcript is best-effort durability. */
    }
  }
}
