/**
 * Post-run memory persistence for agents with longTermMemory enabled.
 *
 * After a team run completes, this module:
 *   1. Validates whether each agent updated its memory file during the run
 *   2. If not, extracts key learnings from the JSONL transcript
 *   3. Appends a structured memory entry with date heading
 *
 * This ensures memory is always persisted even if the agent didn't self-write.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentEntry } from "../localAgents";
import { memoryPathForAgent } from "../agentsMutations";
import type { AgentRunEvent } from "./eventTypes";

type MemoryEntry = {
  agentName: string;
  memoryPath: string;
  whatWorked: string[];
  whatDidnt: string[];
  userPreferences: string[];
  roleInsights: string[];
};

export async function persistAgentMemories(
  agents: AgentEntry[],
  jsonlPath: string,
  runStatus: string,
  preRunSnapshots?: Map<string, string | undefined>
): Promise<void> {
  if (runStatus !== "completed") {
    return;
  }
  const memoryAgents = agents.filter((a) => a.longTermMemory && a.filePath);
  if (memoryAgents.length === 0) {
    return;
  }

  const snapshots = preRunSnapshots ?? await captureMemorySnapshots(memoryAgents);
  const events = await readTranscriptEvents(jsonlPath);
  const today = new Date().toISOString().split("T")[0];

  for (const agent of memoryAgents) {
    const memPath = memoryPathForAgent(agent.filePath!);
    const wasUpdated = await validateMemoryUpdated(memPath, snapshots.get(agent.name));
    if (wasUpdated) {
      continue;
    }
    const entry = extractMemoryFromTranscript(agent.name, events);
    const journal = buildJournalEntry(agent.name, events);
    if ((!entry || isEmptyEntry(entry)) && journal.length === 0) {
      continue;
    }
    const existing = await readMemoryFile(memPath);
    const block = formatMemoryBlock(entry ?? { agentName: agent.name, memoryPath: "", whatWorked: [], whatDidnt: [], userPreferences: [], roleInsights: [] }, today, existing, journal);
    if (!block.trim()) {
      continue;
    }
    await appendMemory(memPath, block);
  }
}

export async function captureMemorySnapshots(
  agents: AgentEntry[]
): Promise<Map<string, string | undefined>> {
  const snapshots = new Map<string, string | undefined>();
  for (const agent of agents) {
    if (!agent.filePath) { continue; }
    const memPath = memoryPathForAgent(agent.filePath);
    try {
      const content = await fs.readFile(memPath, "utf8");
      snapshots.set(agent.name, content.trim() || undefined);
    } catch {
      snapshots.set(agent.name, undefined);
    }
  }
  return snapshots;
}

async function validateMemoryUpdated(
  memPath: string,
  preRunContent: string | undefined
): Promise<boolean> {
  try {
    const current = await fs.readFile(memPath, "utf8");
    const trimmed = current.trim();
    if (!preRunContent && trimmed) {
      return true;
    }
    if (preRunContent && trimmed !== preRunContent) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function readTranscriptEvents(jsonlPath: string): Promise<AgentRunEvent[]> {
  try {
    const content = await fs.readFile(jsonlPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.map((l) => JSON.parse(l) as AgentRunEvent);
  } catch {
    return [];
  }
}

function extractMemoryFromTranscript(
  agentName: string,
  events: AgentRunEvent[]
): MemoryEntry | undefined {
  const agentEvents = events.filter(
    (e) => "agent" in e && e.agent === agentName
  );
  if (agentEvents.length === 0) {
    return undefined;
  }

  const textChunks: string[] = [];
  const toolsUsed: string[] = [];
  let hadErrors = false;
  let wasApproved = false;
  let wasRejected = false;

  for (const ev of agentEvents) {
    if (ev.kind === "assistant_delta") {
      textChunks.push(ev.text);
    } else if (ev.kind === "assistant_message") {
      textChunks.push(ev.text);
    } else if (ev.kind === "tool_use") {
      toolsUsed.push(ev.tool);
    } else if (ev.kind === "error") {
      hadErrors = true;
    }
  }

  // Check for approval/rejection signals in all events
  for (const ev of events) {
    if (ev.kind === "phase_boundary" && "needsApproval" in ev) {
      // Look for subsequent approval/rejection
      const idx = events.indexOf(ev);
      for (let i = idx + 1; i < events.length && i < idx + 20; i++) {
        const next = events[i];
        if (next.kind === "log" && /approved/i.test(next.message)) { wasApproved = true; }
        if (next.kind === "log" && /rejected/i.test(next.message)) { wasRejected = true; }
      }
    }
  }

  const fullText = textChunks.join("");
  const whatWorked = extractWhatWorked(fullText, wasApproved, toolsUsed);
  const whatDidnt = extractWhatDidnt(fullText, hadErrors, wasRejected);
  const userPreferences = extractUserPreferences(fullText);
  const roleInsights = extractRoleInsights(fullText, agentName, toolsUsed);

  return {
    agentName,
    memoryPath: "",
    whatWorked,
    whatDidnt,
    userPreferences,
    roleInsights,
  };
}

function extractWhatWorked(text: string, wasApproved: boolean, toolsUsed: string[]): string[] {
  const items: string[] = [];
  const sentences = splitSentences(text);

  if (wasApproved) {
    items.push("Approach was approved by the user — keep this style");
  }

  const successSignals = [
    /worked well/i, /successful/i, /correctly/i,
    /the fix (was|is)/i, /solved by/i, /resolved/i,
    /good approach/i, /clean(er)? way/i,
    /this works because/i, /effective/i,
  ];

  for (const sentence of sentences) {
    if (successSignals.some((re) => re.test(sentence))) {
      items.push(sentence.replace(/^\s*[-*]\s*/, ""));
      if (items.length >= 4) { break; }
    }
  }

  if (items.length === 0 && toolsUsed.length > 0) {
    const unique = [...new Set(toolsUsed)];
    items.push(`Completed task using: ${unique.slice(0, 5).join(", ")}`);
  }
  return items;
}

function extractWhatDidnt(text: string, hadErrors: boolean, wasRejected: boolean): string[] {
  const items: string[] = [];

  if (wasRejected) {
    items.push("Plan was rejected — rethink approach next time");
  }
  if (hadErrors) {
    items.push("Encountered errors during execution — validate assumptions earlier");
  }

  const sentences = splitSentences(text);
  const failSignals = [
    /didn'?t work/i, /failed/i, /mistake/i, /wrong approach/i,
    /should have/i, /shouldn'?t have/i, /next time/i,
    /lesson learned/i, /avoid/i, /don'?t do/i,
    /broke/i, /regression/i, /overlooked/i,
  ];

  for (const sentence of sentences) {
    if (failSignals.some((re) => re.test(sentence))) {
      items.push(sentence.replace(/^\s*[-*]\s*/, ""));
      if (items.length >= 4) { break; }
    }
  }
  return items;
}

function extractUserPreferences(text: string): string[] {
  const items: string[] = [];
  const sentences = splitSentences(text);

  const prefSignals = [
    /user (prefers?|wants?|likes?)/i, /they (prefer|want|like)/i,
    /convention (is|here)/i, /style (is|guide|preference)/i,
    /always (use|do|include)/i, /never (use|do|include)/i,
    /team (uses|prefers|expects)/i, /codebase (uses|follows)/i,
    /keep it/i, /make sure to/i,
  ];

  for (const sentence of sentences) {
    if (prefSignals.some((re) => re.test(sentence))) {
      items.push(sentence.replace(/^\s*[-*]\s*/, ""));
      if (items.length >= 4) { break; }
    }
  }
  return items;
}

function extractRoleInsights(text: string, agentName: string, toolsUsed: string[]): string[] {
  const items: string[] = [];
  const sentences = splitSentences(text);

  const insightSignals = [
    /important to/i, /key (thing|point|consideration)/i,
    /remember (that|to)/i, /note (that|:)/i,
    /in this (codebase|project|repo)/i,
    /the pattern (is|here)/i, /architecture/i,
    /depends on/i, /requires/i, /must/i,
  ];

  for (const sentence of sentences) {
    if (insightSignals.some((re) => re.test(sentence))) {
      items.push(sentence.replace(/^\s*[-*]\s*/, ""));
      if (items.length >= 4) { break; }
    }
  }
  return items;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);
}

function isEmptyEntry(entry: MemoryEntry): boolean {
  return (
    entry.whatWorked.length === 0 &&
    entry.whatDidnt.length === 0 &&
    entry.userPreferences.length === 0 &&
    entry.roleInsights.length === 0
  );
}

function buildJournalEntry(agentName: string, events: AgentRunEvent[]): string[] {
  const journal: string[] = [];
  const agentEvents = events.filter((e) => "agent" in e && e.agent === agentName);

  const toolUses = agentEvents
    .filter((e) => e.kind === "tool_use")
    .map((e) => {
      const ev = e as { tool: string; input?: unknown };
      const input = ev.input as Record<string, unknown> | undefined;
      if ((ev.tool === "Write" || ev.tool === "Edit") && input?.file_path) {
        return `${ev.tool}: ${input.file_path}`;
      }
      if (ev.tool === "Bash" && input?.command) {
        const cmd = String(input.command);
        return `Bash: ${cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd}`;
      }
      return ev.tool;
    });

  if (toolUses.length > 0) {
    const unique = [...new Set(toolUses)];
    journal.push(...unique.slice(0, 8));
  }
  return journal;
}

function formatMemoryBlock(
  entry: MemoryEntry,
  date: string,
  existing: string | undefined,
  journal: string[]
): string {
  const sections: string[] = [];
  sections.push(`\n### ${date}\n`);

  if (journal.length > 0) {
    sections.push("**What I did:**");
    for (const j of journal.slice(0, 8)) {
      sections.push(`- ${j}`);
    }
  }
  if (entry.whatWorked.length > 0) {
    sections.push("**What worked:**");
    for (const w of dedup(entry.whatWorked, existing)) {
      sections.push(`- ${w}`);
    }
  }
  if (entry.whatDidnt.length > 0) {
    sections.push("**What to avoid:**");
    for (const w of dedup(entry.whatDidnt, existing)) {
      sections.push(`- ${w}`);
    }
  }
  if (entry.userPreferences.length > 0) {
    sections.push("**User preferences:**");
    for (const p of dedup(entry.userPreferences, existing)) {
      sections.push(`- ${p}`);
    }
  }
  if (entry.roleInsights.length > 0) {
    sections.push("**Role insights:**");
    for (const r of dedup(entry.roleInsights, existing)) {
      sections.push(`- ${r}`);
    }
  }

  const content = sections.join("\n");
  if (content.split("\n").filter((l) => l.startsWith("- ")).length === 0) {
    return "";
  }
  return content + "\n";
}

function dedup(items: string[], existing: string | undefined): string[] {
  if (!existing) { return items; }
  const lower = existing.toLowerCase();
  return items.filter((item) => {
    const normalized = item.toLowerCase().trim();
    if (normalized.length < 10) { return true; }
    const words = normalized.split(/\s+/).slice(0, 6).join(" ");
    return !lower.includes(words);
  });
}

async function readMemoryFile(memPath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(memPath, "utf8");
    return content.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function appendMemory(memPath: string, block: string): Promise<void> {
  await fs.mkdir(path.dirname(memPath), { recursive: true });
  try {
    await fs.appendFile(memPath, block, "utf8");
  } catch {
    await fs.writeFile(memPath, block, "utf8");
  }
}
