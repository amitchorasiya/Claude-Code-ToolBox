/**
 * Unified session-card store for the Agent Dashboard.
 *
 * Fed by three ingesters — the hook server (`applyHookEvent`), the per-session
 * transcript watcher (`applyTranscriptPatch`), and the session bridge for our
 * own internal runs (`applyRunBusPatch`). All three converge into one
 * `SessionCard` map; subscribers get a single `change` event on every update.
 */
import { EventEmitter } from "node:events";
import type { AgentRunEvent } from "../runtime/eventTypes";

export type SessionSource = "external" | "internal";

export type SessionCardStatus =
  | "running"
  | "thinking"
  | "idle"
  | "awaiting_permission"
  | "awaiting_approval"
  | "error"
  | "done";

export type ToolFeedEntry = {
  id: string;
  name: string;
  target?: string;
  t: string;
  status?: "running" | "done" | "error";
};

export type SafetyAlert = {
  id: string;
  pattern: string;
  tool: string;
  target?: string;
  t: string;
  acknowledged: boolean;
};

export type SessionCard = {
  sessionId: string;
  source: SessionSource;
  framework: "claude";
  cwd: string;
  title: string;
  status: SessionCardStatus;
  currentTool?: { name: string; target?: string };
  waitingForPermission: boolean;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreate: number;
  };
  costUsd: number;
  context: { used: number; max: number };
  toolFeed: ToolFeedEntry[];
  filesTouched: string[];
  lastMessage?: { from: string; to?: string; text: string; t: string };
  runId?: string;
  teamName?: string;
  protocol?: string;
  runtime?: "native" | "custom" | "agent-teams";
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  pinned?: boolean;
  /** Rolling burn rate (cost USD per minute) for projection. */
  burnRate?: number;
  /** Projected final cost from the current trajectory. */
  projectedCostUsd?: number;
  /** Per-team soft budget; filled from settings when available. */
  budgetUsd?: number;
  /** Safety guardrail alerts (Phase 1.6). */
  safetyAlerts?: SafetyAlert[];
  /** Debate-protocol dissent markers (Phase 1.6). */
  dissentCount?: number;
};

export type SessionPatch = Partial<SessionCard> & {
  sessionId: string;
  /** When set, add to existing costUsd rather than replacing. */
  costUsdDelta?: number;
};

export type HookEventPayload = {
  hook_event_name: string;
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
};

export type StoreSnapshot = { cards: SessionCard[]; generatedAt: string };

const MAX_TOOL_FEED = 8;
const MAX_FILES_TOUCHED = 20;
const DEFAULT_CONTEXT_MAX = 200_000;
const SAFETY_ALERT_MAX = 6;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

function mergeFilesTouched(existing: string[] | undefined, incoming: string[] | undefined): string[] {
  const out = [...(existing ?? [])];
  for (const f of incoming ?? []) {
    if (!f) continue;
    const idx = out.indexOf(f);
    if (idx >= 0) out.splice(idx, 1);
    out.unshift(f);
  }
  return out.slice(0, MAX_FILES_TOUCHED);
}

function appendToolFeed(
  existing: ToolFeedEntry[] | undefined,
  entry: ToolFeedEntry
): ToolFeedEntry[] {
  const out = [...(existing ?? [])];
  const existingIdx = out.findIndex((e) => e.id === entry.id);
  if (existingIdx >= 0) {
    out[existingIdx] = { ...out[existingIdx], ...entry };
    return out;
  }
  out.unshift(entry);
  return out.slice(0, MAX_TOOL_FEED);
}

function newCard(sessionId: string, source: SessionSource): SessionCard {
  const t = nowIso();
  return {
    sessionId,
    source,
    framework: "claude",
    cwd: "",
    title: "",
    status: "idle",
    waitingForPermission: false,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
    costUsd: 0,
    context: { used: 0, max: DEFAULT_CONTEXT_MAX },
    toolFeed: [],
    filesTouched: [],
    startedAt: t,
    updatedAt: t,
  };
}

export type StoreOptions = {
  retainDoneCardsMs?: number;
  defaultContextMax?: number;
};

export type BudgetBreachEvent = {
  sessionId: string;
  runId?: string;
  teamName?: string;
  budgetUsd: number;
  costUsd: number;
  projectedCostUsd: number;
  /** "soft" = projected > budget (warning); "hard" = actual > budget (auto-stop). */
  severity: "soft" | "hard";
};

export class SessionStore {
  private readonly emitter = new EventEmitter();
  private readonly cards = new Map<string, SessionCard>();
  private readonly retainDoneCardsMs: number;
  private readonly defaultContextMax: number;
  private gcTimer?: NodeJS.Timeout;
  /** Sessions we've already warned about — cleared after run_end. */
  private readonly softBreachNotified = new Set<string>();
  private readonly hardBreachNotified = new Set<string>();

  constructor(opts: StoreOptions = {}) {
    this.retainDoneCardsMs = Math.max(0, opts.retainDoneCardsMs ?? 60_000);
    this.defaultContextMax = opts.defaultContextMax ?? DEFAULT_CONTEXT_MAX;
    this.emitter.setMaxListeners(64);
  }

  onChange(listener: (snapshot: StoreSnapshot) => void): () => void {
    this.emitter.on("change", listener);
    return () => this.emitter.off("change", listener);
  }

  onBudgetBreach(listener: (event: BudgetBreachEvent) => void): () => void {
    this.emitter.on("budgetBreach", listener);
    return () => this.emitter.off("budgetBreach", listener);
  }

  snapshot(): StoreSnapshot {
    const cards = Array.from(this.cards.values())
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
    return { cards, generatedAt: nowIso() };
  }

  getCard(sessionId: string): SessionCard | undefined {
    return this.cards.get(sessionId);
  }

  private emitChange(): void {
    this.emitter.emit("change", this.snapshot());
  }

  private upsert(sessionId: string, source: SessionSource): SessionCard {
    let card = this.cards.get(sessionId);
    if (!card) {
      card = newCard(sessionId, source);
      card.context.max = this.defaultContextMax;
      this.cards.set(sessionId, card);
    }
    return card;
  }

  applyPatch(patch: SessionPatch, source: SessionSource = "external"): void {
    if (!patch.sessionId) return;
    const card = this.upsert(patch.sessionId, source);
    const t = nowIso();
    const { costUsdDelta, ...patchRest } = patch;
    const next: SessionCard = {
      ...card,
      ...patchRest,
      sessionId: card.sessionId,
      tokens: { ...card.tokens, ...(patch.tokens ?? {}) },
      context: { ...card.context, ...(patch.context ?? {}) },
      filesTouched: mergeFilesTouched(card.filesTouched, patch.filesTouched),
      updatedAt: t,
    };
    if (costUsdDelta && costUsdDelta > 0) {
      next.costUsd = (card.costUsd ?? 0) + costUsdDelta;
    }
    if (patch.toolFeed && patch.toolFeed.length) {
      next.toolFeed = patch.toolFeed;
    }
    if (patch.safetyAlerts && patch.safetyAlerts.length) {
      next.safetyAlerts = patch.safetyAlerts.slice(-SAFETY_ALERT_MAX);
    }
    if (next.status === "done" && !next.endedAt) {
      next.endedAt = t;
    }
    /* Compute burn rate + projection on every patch.
     * Burn rate = cost-per-minute so far.
     * Projection trajectory = cost + burnRate * (elapsed * 1.5), i.e. assume the
     * run takes ~2.5× as long as it has already (kanban-style forward look).
     * This is honest about the uncertainty and, unlike a budget-based formula,
     * can actually overshoot the budget so we can emit a soft-breach warning. */
    const elapsedMs = Math.max(1, Date.parse(t) - Date.parse(next.startedAt));
    const elapsedMin = elapsedMs / 60_000;
    next.burnRate = next.costUsd / elapsedMin;
    if (next.burnRate > 0) {
      next.projectedCostUsd = next.costUsd + next.burnRate * Math.max(elapsedMin * 1.5, 0.25);
    } else {
      next.projectedCostUsd = next.costUsd;
    }
    this.cards.set(card.sessionId, next);

    /* Phase 2: budget breach notifications (once per run). */
    if (next.budgetUsd && next.status !== "done" && next.status !== "error") {
      if (
        next.costUsd >= next.budgetUsd &&
        !this.hardBreachNotified.has(next.sessionId)
      ) {
        this.hardBreachNotified.add(next.sessionId);
        this.emitter.emit("budgetBreach", {
          sessionId: next.sessionId,
          runId: next.runId,
          teamName: next.teamName,
          budgetUsd: next.budgetUsd,
          costUsd: next.costUsd,
          projectedCostUsd: next.projectedCostUsd ?? next.costUsd,
          severity: "hard",
        });
      } else if (
        next.projectedCostUsd !== undefined &&
        next.projectedCostUsd > next.budgetUsd &&
        next.costUsd < next.budgetUsd &&
        !this.softBreachNotified.has(next.sessionId)
      ) {
        this.softBreachNotified.add(next.sessionId);
        this.emitter.emit("budgetBreach", {
          sessionId: next.sessionId,
          runId: next.runId,
          teamName: next.teamName,
          budgetUsd: next.budgetUsd,
          costUsd: next.costUsd,
          projectedCostUsd: next.projectedCostUsd,
          severity: "soft",
        });
      }
    }
    if (next.status === "done" || next.status === "error") {
      this.softBreachNotified.delete(next.sessionId);
      this.hardBreachNotified.delete(next.sessionId);
    }

    this.emitChange();
  }

  applyHookEvent(payload: HookEventPayload): void {
    const sessionId = payload.session_id;
    if (!sessionId) return;
    const patch: SessionPatch = { sessionId };
    const tool = typeof payload.tool_name === "string" ? payload.tool_name : undefined;
    const target = extractToolTarget(payload.tool_input);
    const t = nowIso();
    const currentCard = this.cards.get(sessionId);
    switch (payload.hook_event_name) {
      case "PreToolUse": {
        patch.status = "running";
        if (tool) {
          patch.currentTool = { name: tool, target };
          patch.toolFeed = appendToolFeed(currentCard?.toolFeed, {
            id: `${t}-${tool}`,
            name: tool,
            target,
            t,
            status: "running",
          });
          if (target) {
            patch.filesTouched = [target];
          }
        }
        break;
      }
      case "PostToolUse": {
        patch.waitingForPermission = false;
        patch.status = "thinking";
        if (tool && currentCard?.toolFeed) {
          const updated = currentCard.toolFeed.map((e) =>
            e.status === "running" && e.name === tool ? { ...e, status: "done" as const } : e
          );
          patch.toolFeed = updated;
        }
        patch.currentTool = undefined;
        break;
      }
      case "PermissionRequest": {
        patch.waitingForPermission = true;
        patch.status = "awaiting_permission";
        if (tool) {
          patch.currentTool = currentCard?.currentTool ?? { name: tool, target };
        }
        break;
      }
      case "Stop":
      case "SubagentStop": {
        patch.status = "done";
        patch.currentTool = undefined;
        patch.waitingForPermission = false;
        break;
      }
      default:
        return;
    }
    if (payload.cwd && !currentCard?.cwd) {
      patch.cwd = payload.cwd;
    }
    this.applyPatch(patch, "external");
  }

  applyRunBusPatch(event: AgentRunEvent, context: { teamId: string; teamName: string; protocol: string; runtime: "native" | "custom" | "agent-teams"; budgetUsd?: number; cwd?: string }): void {
    const sessionId = event.runId;
    if (!sessionId) return;
    const card = this.upsert(sessionId, "internal");
    const patch: SessionPatch = { sessionId };
    patch.source = "internal";
    patch.runId = sessionId;
    patch.teamName = context.teamName;
    patch.protocol = context.protocol;
    patch.runtime = context.runtime;
    if (context.cwd && !card.cwd) patch.cwd = context.cwd;
    if (context.budgetUsd !== undefined) patch.budgetUsd = context.budgetUsd;
    switch (event.kind) {
      case "run_start":
        patch.status = "running";
        patch.title = `${context.teamName} · ${context.protocol}`;
        break;
      case "agent_start":
        patch.status = "running";
        patch.currentTool = undefined;
        patch.lastMessage = {
          from: event.agent,
          text: `▶ ${event.agent} turn ${event.turn}`,
          t: event.t,
        };
        break;
      case "agent_end":
        patch.currentTool = undefined;
        break;
      case "assistant_delta":
        patch.status = "running";
        break;
      case "tool_use":
        patch.currentTool = {
          name: event.tool,
          target: truncate(extractToolTarget(event.input) ?? "", 200),
        };
        patch.toolFeed = appendToolFeed(card.toolFeed, {
          id: event.id ?? `${event.t}-${event.tool}`,
          name: event.tool,
          target: extractToolTarget(event.input),
          t: event.t,
          status: "running",
        });
        break;
      case "tool_result":
        patch.toolFeed = (card.toolFeed ?? []).map((e) =>
          e.id === event.id
            ? { ...e, status: event.ok ? ("done" as const) : ("error" as const) }
            : e
        );
        patch.currentTool = undefined;
        break;
      case "usage":
        patch.tokens = {
          input: card.tokens.input + (event.usage.inputTokens ?? 0),
          output: card.tokens.output + (event.usage.outputTokens ?? 0),
          cacheRead: card.tokens.cacheRead + (event.usage.cacheReadInputTokens ?? 0),
          cacheCreate: card.tokens.cacheCreate + (event.usage.cacheCreationInputTokens ?? 0),
        };
        patch.costUsd = (card.costUsd ?? 0) + (event.usage.costUsd ?? 0);
        patch.context = {
          used:
            (event.usage.inputTokens ?? 0) +
            (event.usage.cacheReadInputTokens ?? 0) +
            (event.usage.cacheCreationInputTokens ?? 0),
          max: card.context.max,
        };
        break;
      case "message":
        patch.lastMessage = {
          from: event.from,
          to: event.to,
          text: truncate(event.text, 220),
          t: event.t,
        };
        /* Phase 1.6 — dissent count carried in specially formatted messages. */
        if (/^dissent:\d+$/i.test(event.text)) {
          const n = parseInt(event.text.split(":")[1] ?? "0", 10);
          if (!isNaN(n) && n > 0) patch.dissentCount = n;
        }
        break;
      case "phase_boundary":
        if (event.needsApproval) {
          patch.status = "awaiting_approval";
        } else {
          patch.status = "running";
        }
        break;
      case "run_end":
        patch.status = event.status === "error" ? "error" : "done";
        patch.currentTool = undefined;
        break;
      case "error":
        patch.status = "error";
        break;
      default:
        break;
    }
    this.applyPatch(patch, "internal");
  }

  setBudgetForInternal(runId: string, budgetUsd: number): void {
    const card = this.cards.get(runId);
    if (!card) return;
    this.applyPatch({ sessionId: runId, budgetUsd }, "internal");
  }

  recordSafetyAlert(sessionId: string, alert: SafetyAlert): void {
    const card = this.cards.get(sessionId);
    const existing = card?.safetyAlerts ?? [];
    this.applyPatch(
      { sessionId, safetyAlerts: [...existing, alert].slice(-SAFETY_ALERT_MAX) },
      card?.source ?? "external"
    );
  }

  acknowledgeSafetyAlert(sessionId: string, alertId: string): void {
    const card = this.cards.get(sessionId);
    if (!card?.safetyAlerts) return;
    const updated = card.safetyAlerts.map((a) =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    );
    this.applyPatch({ sessionId, safetyAlerts: updated }, card.source);
  }

  pin(sessionId: string, pinned: boolean): void {
    if (!this.cards.has(sessionId)) return;
    this.applyPatch({ sessionId, pinned }, this.cards.get(sessionId)!.source);
  }

  remove(sessionId: string): void {
    if (this.cards.delete(sessionId)) {
      this.emitChange();
    }
  }

  /** Periodically drop `done` cards that have been stale longer than retention. */
  startGc(): void {
    if (this.gcTimer || this.retainDoneCardsMs === 0) return;
    this.gcTimer = setInterval(() => {
      const now = Date.now();
      let dropped = 0;
      for (const [id, card] of this.cards) {
        if (card.pinned) continue;
        if (card.status !== "done" && card.status !== "error") continue;
        const endedAt = card.endedAt ? Date.parse(card.endedAt) : Date.parse(card.updatedAt);
        if (now - endedAt >= this.retainDoneCardsMs) {
          this.cards.delete(id);
          dropped += 1;
        }
      }
      if (dropped) this.emitChange();
    }, Math.min(this.retainDoneCardsMs, 10_000));
    this.gcTimer.unref?.();
  }

  dispose(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
    this.cards.clear();
    this.emitter.removeAllListeners();
  }
}

function extractToolTarget(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  const candidates = ["file_path", "path", "notebook_path", "command", "pattern", "query", "url"];
  for (const key of candidates) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) {
      return truncate(v.trim(), 200);
    }
  }
  return undefined;
}
