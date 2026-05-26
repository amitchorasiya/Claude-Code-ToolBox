/**
 * Pure parser for Claude Code transcript JSONL lines.
 *
 * Each line is one JSON event written by `claude` to
 * `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. We turn it into a
 * `SessionPatch` that the session store applies.
 *
 * Important: never throw on malformed lines — the watcher calls us on every
 * new line and we must degrade gracefully.
 */
import type { SessionPatch, ToolFeedEntry } from "./sessionStore";

export type ParseContext = {
  sessionId: string;
  /** When true, carry token / message state but don't set status (initial backfill). */
  skipStatus?: boolean;
};

type UnknownRecord = Record<string, unknown>;

function asObject(v: unknown): UnknownRecord | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as UnknownRecord) : undefined;
}

function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? (v as unknown[]) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

/**
 * Estimate cost from token counts (Sonnet pricing as default).
 * $3/MTok input, $15/MTok output, $0.30/MTok cache read, $3.75/MTok cache write.
 */
function estimateCostFromTokens(
  input: number,
  output: number,
  cacheRead: number,
  cacheCreate: number
): number {
  return (
    (input * 3) / 1_000_000 +
    (output * 15) / 1_000_000 +
    (cacheRead * 0.3) / 1_000_000 +
    (cacheCreate * 3.75) / 1_000_000
  );
}

function extractToolTarget(input: unknown): string | undefined {
  const rec = asObject(input);
  if (!rec) return undefined;
  for (const key of ["file_path", "path", "notebook_path", "command", "pattern", "query", "url"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return truncate(v.trim(), 200);
  }
  return undefined;
}

export function isHumanUserTurn(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  const arr = asArray(content);
  if (!arr) return false;
  /* Human turn contains at least one `text` block and no tool_result blocks. */
  const hasText = arr.some((b) => {
    const rec = asObject(b);
    return rec?.type === "text" && typeof rec.text === "string";
  });
  const hasToolResult = arr.some((b) => asObject(b)?.type === "tool_result");
  return hasText && !hasToolResult;
}

export function parseTranscriptLine(raw: string, ctx: ParseContext): SessionPatch | undefined {
  const line = raw.trim();
  if (!line) return undefined;
  let msg: UnknownRecord;
  try {
    const parsed: unknown = JSON.parse(line);
    const obj = asObject(parsed);
    if (!obj) return undefined;
    msg = obj;
  } catch {
    return undefined;
  }
  const patch: SessionPatch = { sessionId: ctx.sessionId };
  const type = asString(msg.type) ?? "";
  const subtype = asString(msg.subtype) ?? "";

  /* cwd often lives on the session's first record. */
  const cwd = asString(msg.cwd);
  if (cwd) patch.cwd = cwd;

  if (type === "system") {
    if (subtype === "stop_hook_summary" && !ctx.skipStatus) {
      patch.status = "done";
      patch.currentTool = undefined;
      return patch;
    }
    if (subtype === "compact_boundary") {
      patch.context = { used: 0, max: 0 };
      return patch;
    }
    return undefined;
  }

  if (type === "user") {
    const message = asObject(msg.message);
    const content = message?.content;
    if (isHumanUserTurn(content)) {
      /* First human turn seeds the title. */
      const textBlock =
        typeof content === "string"
          ? content
          : ((asArray(content) ?? [])
              .map((b) => asObject(b))
              .find((b) => b?.type === "text")?.text as string | undefined);
      if (textBlock) {
        patch.title = truncate(textBlock.trim().replace(/\s+/g, " "), 120);
      }
      if (!ctx.skipStatus) {
        patch.status = "thinking";
        patch.currentTool = undefined;
      }
      return patch;
    }
    /* Tool-result turn: only clear current tool. */
    if (!ctx.skipStatus) {
      patch.currentTool = undefined;
    }
    return patch;
  }

  if (type === "assistant") {
    const message = asObject(msg.message);
    const blocks = asArray(message?.content) ?? [];
    const newFeedEntries: ToolFeedEntry[] = [];
    for (const block of blocks) {
      const rec = asObject(block);
      if (!rec) continue;
      if (rec.type === "tool_use") {
        const name = asString(rec.name) ?? "Tool";
        const id = asString(rec.id) ?? `${Date.now()}-${name}`;
        const target = extractToolTarget(rec.input);
        newFeedEntries.push({
          id,
          name,
          target,
          t: asString(msg.timestamp) ?? new Date().toISOString(),
          status: "running",
        });
        if (!ctx.skipStatus) {
          patch.currentTool = { name, target };
          patch.status = "running";
        }
        if (target) {
          patch.filesTouched = [...(patch.filesTouched ?? []), target];
        }
      }
    }
    if (newFeedEntries.length) patch.toolFeed = newFeedEntries;
    /* Usage deltas. */
    const usage = asObject(message?.usage);
    if (usage) {
      const input = asNumber(usage.input_tokens) ?? 0;
      const output = asNumber(usage.output_tokens) ?? 0;
      const cacheRead = asNumber(usage.cache_read_input_tokens) ?? 0;
      const cacheCreate = asNumber(usage.cache_creation_input_tokens) ?? 0;
      patch.tokens = { input, output, cacheRead, cacheCreate };
      patch.context = {
        used: input + cacheRead + cacheCreate,
        max: 200_000,
      };
      const totalCost = asNumber(msg.total_cost_usd);
      if (totalCost) {
        patch.costUsd = totalCost;
      } else if (input + output + cacheRead + cacheCreate > 0) {
        patch.costUsdDelta = estimateCostFromTokens(input, output, cacheRead, cacheCreate);
      }
    }
    return patch;
  }

  if (type === "result") {
    const usage = asObject(msg.usage);
    if (usage) {
      const input = asNumber(usage.input_tokens) ?? 0;
      const output = asNumber(usage.output_tokens) ?? 0;
      const cacheRead = asNumber(usage.cache_read_input_tokens) ?? 0;
      const cacheCreate = asNumber(usage.cache_creation_input_tokens) ?? 0;
      patch.tokens = { input, output, cacheRead, cacheCreate };
      const totalCost = asNumber(msg.total_cost_usd);
      if (totalCost) {
        patch.costUsd = totalCost;
      } else if (input + output + cacheRead + cacheCreate > 0) {
        patch.costUsdDelta = estimateCostFromTokens(input, output, cacheRead, cacheCreate);
      }
    } else {
      const totalCost = asNumber(msg.total_cost_usd);
      if (totalCost) patch.costUsd = totalCost;
    }
    if (subtype === "success" && !ctx.skipStatus) {
      patch.status = "done";
    } else if (subtype && subtype !== "success" && !ctx.skipStatus) {
      patch.status = "error";
    }
    return patch;
  }

  return undefined;
}
