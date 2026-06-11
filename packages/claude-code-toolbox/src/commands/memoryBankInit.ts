import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as mcpPaths from "../mcpPaths";

export type InitMemoryBankOptions = {
  dryRun: boolean;
  cursorRules?: boolean;
};

const BANK_DIR = "memory-bank";

const CLAUDE_MD_MARKER_BEGIN = "<!-- claude-code-memory-bank:begin -->";
const CLAUDE_MD_MARKER_END = "<!-- claude-code-memory-bank:end -->";

const TEMPLATES: Record<string, string> = {
  "projectbrief.md": `# Project brief

Summarize **what this project is**, who it is for, and the **definition of done** for the current phase.

- **Goal**:
- **Non-goals**:
- **Success criteria**:

_Update this when scope changes. Paths in this memory bank: \`{{BANK_PATH}}/\`._`,

  "productContext.md": `# Product context

Explain **why** this product exists and the experience you want users to have.

- **Problem**:
- **Primary users**:
- **UX principles**:
- **Constraints** (compliance, accessibility, performance targets):`,

  "activeContext.md": `# Active context

**Current focus** (one short paragraph):

**In progress**:

- [ ]

**Decisions (recent)**:

-

**Open questions**:

-

_Update when the task or branch focus changes._`,

  "systemPatterns.md": `# System patterns

Document **architecture** and **recurring patterns** so Copilot stays aligned.

- **High-level layout** (modules, services, boundaries):
- **Data flow**:
- **Patterns to follow** (naming, error handling, testing style):
- **Patterns to avoid**:

_Link to key files or packages when it saves repetition._`,

  "techContext.md": `# Tech context

**Stack**

- Language / runtime:
- Framework:
- Package manager:
- Major dependencies:

**Environment**

- Node / Python / etc. versions:
- Required env vars (names only; no secrets):

**Build & test**

- Commands:

**Constraints**

- Hosting, browser support, API limits:`,

  "progress.md": `# Progress

**What works**

-

**Not started / backlog**

-

**Known issues**

-

_Keep bullets factual and small; link issues or PRs when useful._`,
};

const CLAUDE_MD_SNIPPET = `# Memory bank (persistent context)

This repository uses a **memory bank** under \`{{BANK_PATH}}/\` — structured markdown that survives sessions, similar to Cursor-style workflows.

Context layers (read deeper files after foundations): **projectbrief** → **productContext** / **systemPatterns** / **techContext** → **activeContext** → **progress**.

## What Claude should do

1. **Before substantive work**, read **all** of the following under \`{{BANK_PATH}}/\` when the task depends on project state (not optional for non-trivial work). In **Plan mode**, reading for the plan is allowed; **do not edit** these files until **Act mode** unless the user only asked for a documentation/memory update with no code change.
   - \`projectbrief.md\` — scope and goals
   - \`productContext.md\` — product intent and UX
   - \`systemPatterns.md\` — architecture and conventions
   - \`techContext.md\` — stack and constraints
   - \`progress.md\` — done / pending / known issues
   - \`activeContext.md\` — current task and decisions

2. **During Act-mode work**, keep \`activeContext.md\` aligned with the current task (update when focus shifts).

3. **After meaningful milestones** (in Act mode), update \`progress.md\` and any affected docs in \`{{BANK_PATH}}/\`.

4. When the user asks to **update memory bank** (or similar), **open and review every** file in \`{{BANK_PATH}}/\`, then update what changed — especially \`activeContext.md\` and \`progress.md\`, even if other files are unchanged. Prefer doing heavy memory-bank writes in **Act mode** unless the user asked for documentation-only updates.

5. Prefer **short, factual updates** over long prose. Reference files, symbols, and tickets instead of duplicating code.

Do not delete these files; evolve them as the project changes.`;

function initMemoryBankInline(cwd: string, opts: InitMemoryBankOptions): {
  created: string[];
  skipped: string[];
  claudeMdMerged: boolean;
} {
  const root = path.resolve(cwd);
  const bankRoot = path.join(root, BANK_DIR);
  const bankDisplay = `./${BANK_DIR}`;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const [name, template] of Object.entries(TEMPLATES)) {
    const dest = path.join(bankRoot, name);
    if (fs.existsSync(dest)) {
      skipped.push(dest);
      continue;
    }
    if (opts.dryRun) continue;
    fs.mkdirSync(bankRoot, { recursive: true });
    const body = template.replaceAll("{{BANK_PATH}}", bankDisplay);
    fs.writeFileSync(dest, body + "\n", "utf8");
    created.push(dest);
  }

  let claudeMdMerged = false;
  if (!opts.dryRun) {
    claudeMdMerged = mergeClaudeMd(root, bankDisplay);
  }

  return { created, skipped, claudeMdMerged };
}

function mergeClaudeMd(root: string, bankDisplay: string): boolean {
  const claudeMdPath = path.join(root, "CLAUDE.md");
  const snippet = CLAUDE_MD_SNIPPET.replaceAll("{{BANK_PATH}}", bankDisplay);
  const block = `\n${CLAUDE_MD_MARKER_BEGIN}\n${snippet}\n${CLAUDE_MD_MARKER_END}\n`;

  let existing = "";
  if (fs.existsSync(claudeMdPath)) {
    existing = fs.readFileSync(claudeMdPath, "utf8");
  }

  if (existing.includes(CLAUDE_MD_MARKER_BEGIN) && existing.includes(CLAUDE_MD_MARKER_END)) {
    const re = new RegExp(
      escapeRegex(CLAUDE_MD_MARKER_BEGIN) + "[\\s\\S]*?" + escapeRegex(CLAUDE_MD_MARKER_END) + "\\n*",
      "m"
    );
    const updated = existing.replace(re, block.trimStart());
    fs.writeFileSync(claudeMdPath, updated, "utf8");
    return true;
  }

  if (!existing.trim()) {
    fs.writeFileSync(claudeMdPath, `# Claude Code — project context\n${block}`, "utf8");
  } else {
    fs.writeFileSync(claudeMdPath, existing.trimEnd() + "\n" + block, "utf8");
  }
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Run memory bank init in-process using embedded templates (no external package needed).
 */
export async function runInitMemoryBankInProcess(
  folder: vscode.WorkspaceFolder,
  opts: InitMemoryBankOptions
): Promise<void> {
  try {
    const result = initMemoryBankInline(folder.uri.fsPath, opts);

    const summary: string[] = [];
    if (result.created.length > 0) {
      summary.push(`Created ${result.created.length} file(s)`);
    }
    if (result.skipped.length > 0) {
      summary.push(`Skipped ${result.skipped.length} existing file(s)`);
    }
    if (result.claudeMdMerged) {
      summary.push("Merged memory bank section into CLAUDE.md");
    }

    if (opts.dryRun) {
      vscode.window.showInformationMessage(
        `[Dry run] Memory bank preview complete. ${summary.join(", ")}`
      );
    } else {
      vscode.window.showInformationMessage(
        `Memory bank initialized. ${summary.join(", ")}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Memory bank init failed: ${msg}`);
    throw err;
  }
}

export async function initMemoryBank(): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const dryPick = await vscode.window.showQuickPick(
    [
      {
        label: "Yes → real run",
        description: "Run init and write files",
        alwaysShow: true,
        value: false as const,
      },
      {
        label: "Yes (dry-run only)",
        description: "Preview only; no files changed",
        alwaysShow: true,
        value: true as const,
      },
    ],
    { title: "Preview only (--dry-run)?", placeHolder: "Choose with ↑↓ or click" }
  );
  if (dryPick === undefined) {
    return;
  }

  const cursorRulesPick = await vscode.window.showQuickPick(
    [
      { label: "No", description: "CLAUDE.md + memory bank only", alwaysShow: true, value: false as const },
      { label: "Yes", description: "Also add .cursor/rules/*.mdc", alwaysShow: true, value: true as const },
    ],
    { title: "Also write Cursor .mdc rules? (--cursor-rules)", placeHolder: "Pick one" }
  );
  if (cursorRulesPick === undefined) {
    return;
  }

  await runInitMemoryBankInProcess(folder, {
    dryRun: dryPick.value,
    cursorRules: cursorRulesPick.value,
  });
}
