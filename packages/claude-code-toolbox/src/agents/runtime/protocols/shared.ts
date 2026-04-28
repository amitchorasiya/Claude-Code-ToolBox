/**
 * Shared helpers for protocol implementations: usage accumulation, fenced-plan
 * extraction, transcript building, and message helpers.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentEntry } from "../../localAgents";
import type { AgentRunEvent, RunUsage } from "../eventTypes";
import { nowIso } from "../eventTypes";
import type { RunBus } from "../runBus";
import type { SpawnAgentTurnFn } from "../runtimeTypes";

export function makeTotals(): RunUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

export function addUsage(totals: RunUsage, u: RunUsage): void {
  totals.inputTokens += u.inputTokens;
  totals.outputTokens += u.outputTokens;
  totals.costUsd += u.costUsd;
}

/** Capture the last assistant message for an agent so protocols can pass it
 *  forward as context for the next agent. */
export type TurnBuffer = {
  text: string;
  deltas: string[];
};

export function makeTurnBuffer(): TurnBuffer {
  return { text: "", deltas: [] };
}

export function collectTurnEvents(
  buf: TurnBuffer,
  totals: RunUsage,
  ev: AgentRunEvent
): void {
  if (ev.kind === "assistant_delta") {
    buf.deltas.push(ev.text);
  } else if (ev.kind === "assistant_message") {
    buf.text = ev.text;
  } else if (ev.kind === "usage") {
    addUsage(totals, ev.usage);
  }
}

export function finalizeTurnText(buf: TurnBuffer): string {
  if (buf.text) {
    return buf.text;
  }
  return buf.deltas.join("");
}

/**
 * Extract text inside <plan>…</plan> tags. Falls back to the full message when
 * no tags are present (so plan agents don't silently drop a plan).
 */
export function extractPlan(message: string): string {
  const m = message.match(/<plan>([\s\S]*?)<\/plan>/i);
  if (m) {
    return m[1].trim();
  }
  return message.trim();
}

export async function writePlanArtifact(
  runDir: string,
  planMd: string,
  bus: RunBus,
  authorAgent: string,
  filename = "plan.md"
): Promise<string> {
  await fs.mkdir(runDir, { recursive: true });
  const planPath = path.join(runDir, filename);
  await fs.writeFile(planPath, planMd.endsWith("\n") ? planMd : `${planMd}\n`, "utf8");
  bus.emit({
    kind: "plan_artifact",
    t: nowIso(),
    runId: bus.runId,
    agent: authorAgent,
    path: planPath,
    bytes: Buffer.byteLength(planMd, "utf8"),
  });
  return planPath;
}

/** Drive a single agent turn, forwarding events to the bus and returning the
 *  assistant text + accumulated usage. */
export async function runOneTurn(args: {
  spawn: SpawnAgentTurnFn;
  agent: AgentEntry;
  prompt: string;
  runId: string;
  turn: number;
  phase: "plan" | "code" | "none";
  bus: RunBus;
  totals: RunUsage;
  cwd?: string;
  signal: AbortSignal;
  claudeBin?: string;
}): Promise<{ text: string; errored: boolean; aborted: boolean }> {
  const buf = makeTurnBuffer();
  let errored = false;
  let aborted = false;
  for await (const ev of args.spawn({
    agent: args.agent,
    prompt: args.prompt,
    runId: args.runId,
    turn: args.turn,
    phase: args.phase,
    cwd: args.cwd,
    signal: args.signal,
    claudeBin: args.claudeBin,
  })) {
    args.bus.emit(ev);
    collectTurnEvents(buf, args.totals, ev);
    if (ev.kind === "error") {
      errored = true;
    }
    if (ev.kind === "agent_end" && ev.status === "aborted") {
      aborted = true;
    }
  }
  return { text: finalizeTurnText(buf), errored, aborted };
}

export function emitMessage(bus: RunBus, from: string, to: string, text: string): void {
  bus.emit({ kind: "message", t: nowIso(), runId: bus.runId, from, to, text });
}

export function findAgentByName(list: AgentEntry[], name: string): AgentEntry | undefined {
  return list.find((a) => a.name === name);
}

export function describeTranscriptForJudge(
  rounds: { agent: string; text: string }[]
): string {
  return rounds
    .map((r, i) => `### Turn ${i + 1} — ${r.agent}\n\n${r.text.trim()}`)
    .join("\n\n");
}
