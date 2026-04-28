/**
 * Spawn a `claude` CLI subprocess with `--output-format stream-json`, parse
 * each line, and yield normalized `AgentRunEvent`s onto an async iterator.
 *
 * Cross-platform:
 *   - `spawn` with `shell: false` + args as array (no shell quoting).
 *   - Windows: resolve `claude.cmd` / `claude.exe` through the resolver in
 *     ../claudeCliResolver.ts (shell-false spawns can't run `.cmd` shims by name).
 *   - Process-tree kill: POSIX sends SIGTERM to the detached process group;
 *     Windows spawns `taskkill /pid … /T /F`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { resolveClaudeBin } from "../claudeCliResolver";
import type { AgentEntry } from "../localAgents";
import type { AgentRunEvent, RunPhase } from "./eventTypes";
import { nowIso, summarizeForTranscript } from "./eventTypes";

export type SpawnAgentTurnOptions = {
  agent: AgentEntry;
  prompt: string;
  runId: string;
  turn: number;
  phase: RunPhase;
  /** Working directory for the claude process — usually the workspace root. */
  cwd?: string;
  /** Override `claude` binary path (falls back to PATH resolution). */
  claudeBin?: string;
  /** Resume a previous session-id. */
  sessionId?: string;
  /** Additional env vars for the child. */
  env?: NodeJS.ProcessEnv;
  /** Abort signal to kill the child mid-turn. */
  signal?: AbortSignal;
  /** Max wall-clock seconds before we force-kill (default 300). */
  timeoutSec?: number;
};

export type SpawnSessionOptions = {
  prompt: string;
  runId: string;
  phase: RunPhase;
  cwd?: string;
  claudeBin?: string;
  sessionId?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutSec?: number;
  /** Whitelist of agent names the native Task tool is allowed to invoke. */
  allowedAgents?: string[];
  /** Extra `--append-system-prompt` content (orchestrator injects plan.md here). */
  appendSystemPrompt?: string;
};

export class ClaudeCliMissingError extends Error {
  constructor() {
    super("claude CLI not found on PATH. Install Claude Code or set agentTeams.claudeBinOverride.");
  }
}

function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Kill the process tree. On POSIX we spawn with `detached: true` and negate the
 * pid; on Windows we call `taskkill /T /F` via a short-lived helper child.
 */
export function killProcessTree(child: ChildProcess): void {
  if (!child.pid) {
    return;
  }
  if (isWindows()) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

export type SpawnEventEmitter = (event: AgentRunEvent) => void;

type ParseContext = {
  runId: string;
  /** Agent name is passed in for per-turn spawns; native sessions overwrite it from Task events. */
  agent: string;
  phase: RunPhase;
};

/**
 * Translate a single stream-json line into zero or more AgentRunEvents.
 * Exported for tests — so we can validate parsing without a real CLI.
 */
export function parseStreamJsonLine(line: string, ctx: ParseContext): AgentRunEvent[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return [];
  }
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [{ kind: "log", t: nowIso(), runId: ctx.runId, level: "warn", message: `unparsed line: ${summarizeForTranscript(trimmed)}` }];
  }
  const out: AgentRunEvent[] = [];
  const t = nowIso();
  const type = typeof msg.type === "string" ? (msg.type as string) : "";
  const subtype = typeof msg.subtype === "string" ? (msg.subtype as string) : "";

  if (type === "assistant") {
    /* Shape: { type: "assistant", message: { content: [...] } } */
    const message = msg.message as { content?: unknown } | undefined;
    const content = Array.isArray(message?.content) ? (message?.content as unknown[]) : [];
    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        out.push({ kind: "assistant_delta", t, runId: ctx.runId, agent: ctx.agent, text: b.text });
      } else if (b.type === "tool_use") {
        const tool = typeof b.name === "string" ? (b.name as string) : "Tool";
        const id = typeof b.id === "string" ? (b.id as string) : undefined;
        const input = b.input;
        out.push({ kind: "tool_use", t, runId: ctx.runId, agent: ctx.agent, tool, input, id });
        /* Task tool → native sub-agent handoff. */
        if (tool === "Task" && input && typeof input === "object") {
          const i = input as Record<string, unknown>;
          const sub = typeof i.subagent_type === "string" ? (i.subagent_type as string) : "agent";
          out.push({ kind: "agent_start", t, runId: ctx.runId, agent: sub, turn: 0, phase: ctx.phase });
        }
      }
    }
    return out;
  }

  if (type === "user") {
    /* Tool result passed back to the assistant. */
    const message = msg.message as { content?: unknown } | undefined;
    const content = Array.isArray(message?.content) ? (message?.content as unknown[]) : [];
    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const b = block as Record<string, unknown>;
      if (b.type === "tool_result") {
        const id = typeof b.tool_use_id === "string" ? (b.tool_use_id as string) : undefined;
        const ok = b.is_error !== true;
        const raw = b.content;
        let summary = "";
        if (typeof raw === "string") {
          summary = summarizeForTranscript(raw);
        } else if (Array.isArray(raw)) {
          const first = raw[0];
          if (first && typeof first === "object" && "text" in (first as Record<string, unknown>)) {
            summary = summarizeForTranscript((first as Record<string, unknown>).text);
          }
        }
        out.push({ kind: "tool_result", t, runId: ctx.runId, agent: ctx.agent, ok, summary, id });
      }
    }
    return out;
  }

  if (type === "result") {
    const ok = subtype === "success" || msg.is_error !== true;
    const usage = msg.usage as Record<string, unknown> | undefined;
    const totals = {
      inputTokens: typeof usage?.input_tokens === "number" ? (usage.input_tokens as number) : 0,
      outputTokens: typeof usage?.output_tokens === "number" ? (usage.output_tokens as number) : 0,
      costUsd: typeof msg.total_cost_usd === "number" ? (msg.total_cost_usd as number) : 0,
      cacheReadInputTokens:
        typeof usage?.cache_read_input_tokens === "number"
          ? (usage.cache_read_input_tokens as number)
          : undefined,
      cacheCreationInputTokens:
        typeof usage?.cache_creation_input_tokens === "number"
          ? (usage.cache_creation_input_tokens as number)
          : undefined,
    };
    out.push({
      kind: "usage",
      t,
      runId: ctx.runId,
      agent: ctx.agent,
      usage: totals,
    });
    if (ok) {
      out.push({ kind: "log", t, runId: ctx.runId, level: "info", message: "result: success" });
    } else {
      const err = typeof msg.result === "string" ? (msg.result as string) : subtype || "error";
      out.push({ kind: "error", t, runId: ctx.runId, agent: ctx.agent, message: err });
    }
    return out;
  }

  if (type === "system") {
    if (subtype === "init") {
      out.push({ kind: "log", t, runId: ctx.runId, level: "info", message: "claude session initialised" });
    }
    return out;
  }

  return [];
}

/** Resolve the binary, returning `undefined` when not found. */
export async function resolveBin(override?: string): Promise<string | undefined> {
  return resolveClaudeBin(override);
}

function defaultTimeoutMs(sec?: number): number {
  return Math.max(10_000, Math.min((sec ?? 300) * 1_000, 30 * 60_000));
}

type SpawnCore = {
  child: ChildProcess;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  /** Resolves when the child has fully exited (stdout closed + exit code). */
  done: Promise<number>;
};

function spawnCore(binPath: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv }): SpawnCore {
  const child = spawn(binPath, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: false,
    windowsHide: true,
    detached: !isWindows(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!child.stdout || !child.stderr) {
    throw new Error("claude child did not provide stdout/stderr streams");
  }
  const stdout = child.stdout;
  const stderr = child.stderr;
  const done = new Promise<number>((resolve) => {
    let code: number | null = null;
    child.on("exit", (c) => {
      code = c ?? 0;
    });
    child.on("close", () => resolve(code ?? 0));
  });
  return { child, stdout, stderr, done };
}

async function* iterateLines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  let buf = "";
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    buf += typeof chunk === "string" ? chunk : decoder.decode(chunk as Buffer);
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line.length) {
        yield line;
      }
    }
  }
  if (buf.trim().length) {
    yield buf;
  }
}

/**
 * Run a single `claude` invocation and yield parsed events. Used by both
 * native-task (one session runs to completion) and custom-runtime per-turn
 * spawns.
 */
export async function* runClaudeAndEmit(
  binPath: string,
  args: string[],
  ctx: ParseContext,
  opts: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    timeoutSec?: number;
  }
): AsyncIterable<AgentRunEvent> {
  const { child, stdout, stderr, done } = spawnCore(binPath, args, { cwd: opts.cwd, env: opts.env });
  const timeout = setTimeout(() => killProcessTree(child), defaultTimeoutMs(opts.timeoutSec));
  const onAbort = () => killProcessTree(child);
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let stderrBuf = "";
    stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString("utf8");
      if (stderrBuf.length > 4096) {
        stderrBuf = stderrBuf.slice(-4096);
      }
    });
    for await (const line of iterateLines(stdout)) {
      for (const ev of parseStreamJsonLine(line, ctx)) {
        yield ev;
      }
    }
    const code = await done;
    if (code !== 0) {
      yield {
        kind: "error",
        t: nowIso(),
        runId: ctx.runId,
        agent: ctx.agent,
        message: `claude exited with code ${code}${stderrBuf ? `: ${summarizeForTranscript(stderrBuf)}` : ""}`,
      };
    }
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Spawn a single `claude` session for the native runtime. Runs to completion —
 * the session itself decides whether / which subagents to call via Task.
 */
export async function* spawnClaudeSession(
  opts: SpawnSessionOptions
): AsyncIterable<AgentRunEvent> {
  const binPath = await resolveBin(opts.claudeBin);
  if (!binPath) {
    throw new ClaudeCliMissingError();
  }
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }
  if (opts.allowedAgents && opts.allowedAgents.length) {
    args.push("--allowed-agents", opts.allowedAgents.join(","));
  }
  if (opts.appendSystemPrompt && opts.appendSystemPrompt.trim()) {
    args.push("--append-system-prompt", opts.appendSystemPrompt);
  }
  yield* runClaudeAndEmit(
    binPath,
    args,
    { runId: opts.runId, agent: "orchestrator", phase: opts.phase },
    { cwd: opts.cwd, env: opts.env, signal: opts.signal, timeoutSec: opts.timeoutSec }
  );
}

/**
 * Spawn a single agent turn for the custom runtime. The agent's system prompt
 * is appended explicitly so the turn runs in that agent's persona even though
 * Claude's own subagent dispatch isn't involved.
 */
export async function* spawnAgentTurn(
  opts: SpawnAgentTurnOptions
): AsyncIterable<AgentRunEvent> {
  const binPath = await resolveBin(opts.claudeBin);
  if (!binPath) {
    throw new ClaudeCliMissingError();
  }
  const systemPrompt = [
    opts.agent.systemPrompt.trim(),
    "",
    `## Your identity`,
    `You are the agent "${opts.agent.name}" with role "${opts.agent.role}" in a multi-agent team run.`,
    `Reply directly — do not delegate via the Task tool.`,
  ].join("\n");
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--append-system-prompt",
    systemPrompt,
  ];
  if (opts.agent.model && opts.agent.model.trim()) {
    args.push("--model", opts.agent.model.trim());
  }
  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }
  const start = Date.now();
  yield {
    kind: "agent_start",
    t: nowIso(),
    runId: opts.runId,
    agent: opts.agent.name,
    color: opts.agent.color,
    turn: opts.turn,
    phase: opts.phase,
  };
  let status: "ok" | "error" | "aborted" = "ok";
  try {
    for await (const ev of runClaudeAndEmit(
      binPath,
      args,
      { runId: opts.runId, agent: opts.agent.name, phase: opts.phase },
      { cwd: opts.cwd, env: opts.env, signal: opts.signal, timeoutSec: opts.timeoutSec }
    )) {
      if (ev.kind === "error") {
        status = "error";
      }
      yield ev;
    }
  } catch (e) {
    status = "error";
    yield {
      kind: "error",
      t: nowIso(),
      runId: opts.runId,
      agent: opts.agent.name,
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    if (opts.signal?.aborted) {
      status = "aborted";
    }
    yield {
      kind: "agent_end",
      t: nowIso(),
      runId: opts.runId,
      agent: opts.agent.name,
      turn: opts.turn,
      status,
      durationMs: Date.now() - start,
    };
  }
}
