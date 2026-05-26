/**
 * Subscribe to a RunBus and write a human-readable `transcript.md` alongside
 * the machine-readable `transcript.jsonl`.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentRunEvent } from "./eventTypes";
import type { RunBus } from "./runBus";

function truncate(s: string, n: number): string {
  if (!s || s.length <= n) return s ?? "";
  return `${s.slice(0, n)}…`;
}

function fmtCost(n: number): string {
  if (!n || !isFinite(n)) return "$0.00";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function attachMarkdownTranscript(bus: RunBus, runDir: string): () => void {
  const mdPath = path.join(runDir, "transcript.md");
  let writeQueue: Promise<void> = Promise.resolve();
  let deltaBuffer = "";
  let currentAgent = "";

  function append(text: string): void {
    writeQueue = writeQueue
      .then(async () => {
        await fs.mkdir(path.dirname(mdPath), { recursive: true });
        await fs.appendFile(mdPath, text, "utf8");
      })
      .catch(() => {});
  }

  function flushDeltas(): void {
    if (deltaBuffer.trim()) {
      append(`${deltaBuffer.trim()}\n\n`);
    }
    deltaBuffer = "";
  }

  return bus.on((ev: AgentRunEvent) => {
    try {
      switch (ev.kind) {
        case "run_start":
          append(
            `# Team Run: ${ev.teamName}\n\n` +
            `**Protocol:** ${ev.protocol} | **Runtime:** ${ev.runtime} | **Started:** ${ev.t}\n\n---\n\n`
          );
          break;

        case "agent_start":
          flushDeltas();
          currentAgent = ev.agent;
          append(`## ${ev.agent} (Turn ${ev.turn}, Phase: ${ev.phase})\n\n`);
          break;

        case "assistant_delta":
          deltaBuffer += ev.text;
          break;

        case "agent_end":
          flushDeltas();
          currentAgent = "";
          append(`*Completed in ${ev.durationMs}ms — ${ev.status}*\n\n`);
          break;

        case "tool_use": {
          const inputSummary = ev.input ? truncate(JSON.stringify(ev.input), 200) : "";
          append(`> **Tool:** \`${ev.tool}\`${inputSummary ? `\n> Input: ${inputSummary}` : ""}\n\n`);
          break;
        }

        case "tool_result":
          append(`> **Result** (${ev.ok ? "OK" : "Error"}): ${truncate(ev.summary ?? "", 300)}\n\n`);
          break;

        case "usage":
          append(
            `*Tokens: in ${ev.usage.inputTokens} / out ${ev.usage.outputTokens} | Cost: ${fmtCost(ev.usage.costUsd)}*\n\n`
          );
          break;

        case "message":
          append(`**${ev.from} → ${ev.to}:** ${ev.text}\n\n`);
          break;

        case "phase_boundary":
          append(`\n---\n\n### Phase: ${ev.to}${ev.needsApproval ? " (awaiting approval)" : ""}\n\n`);
          break;

        case "plan_artifact":
          append(`> Plan artifact saved: \`${ev.path}\`\n\n`);
          break;

        case "error":
          append(`\n**ERROR** (${ev.agent ?? "system"}): ${ev.message}\n\n`);
          break;

        case "run_end":
          flushDeltas();
          append(
            `\n---\n\n**Run ${ev.status}** | Total: in ${ev.totals?.inputTokens ?? 0} / out ${ev.totals?.outputTokens ?? 0} | Cost: ${fmtCost(ev.totals?.costUsd ?? 0)}\n`
          );
          break;

        default:
          break;
      }
    } catch {
      /* transcript is best-effort */
    }
  });
}
