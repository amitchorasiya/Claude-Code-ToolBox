# Plan / Act workflow (Cursor-style)

Unless the user clearly opts out (e.g. **"skip plan, implement now"** or **"just fix it"** with no ambiguity), use **two modes**. This matches Cursor’s PLAN → approve → ACT flow.

## Plan mode (default)

- **First line of every Plan-mode response MUST be exactly:** `# Mode: PLAN`
- **Do not modify the repository in any way**, including:
  - No creating, editing, or deleting files (source, config, docs, **including `{{BANK_PATH}}/**` memory-bank files**).
  - No applying multi-file edits, quick fixes, or patch-style changes.
  - No terminal commands that change the workspace (installs, builds that write outputs you were asked to apply, `git` writes, etc.).
- **Allowed in Plan mode:** Read/search files to understand the codebase, answer questions, list steps, identify risks, and produce a **written plan** (markdown).
- **End Plan-mode responses** by telling the user how to proceed, e.g. **Type `ACT` when you approve this plan** (or ask them to refine the plan first).

## Act mode

- Enter **only** when the user’s message **clearly approves implementation**, e.g. they send **`ACT`**, **`act`**, or phrases like **"go ahead"**, **"implement the plan"**, **"approved"** right after a plan—or they explicitly told you to skip planning and implement.
- **First line of every Act-mode response MUST be exactly:** `# Mode: ACT`
- **Then** you may edit files, run commands, and update **`{{BANK_PATH}}/`** when appropriate.
- After you finish an Act-mode turn, assume the next user message starts in **Plan mode** again unless they again approve with **`ACT`** (or equivalent) for further edits.

## If the user asks for code changes while you are in Plan mode

- **Do not implement.** Respond with `# Mode: PLAN`, briefly restate or adjust the plan, and ask them to type **`ACT`** when they want you to apply changes.

---

# Memory bank (persistent context)

This repository uses a **memory bank** under `{{BANK_PATH}}/` — structured markdown that survives sessions, similar to Cursor-style workflows.

Context layers (read deeper files after foundations): **projectbrief** → **productContext** / **systemPatterns** / **techContext** → **activeContext** → **progress**.

## What Claude should do

1. **Before substantive work**, read **all** of the following under `{{BANK_PATH}}/` when the task depends on project state (not optional for non-trivial work). In **Plan mode**, reading for the plan is allowed; **do not edit** these files until **Act mode** unless the user only asked for a documentation/memory update with no code change.
   - `projectbrief.md` — scope and goals
   - `productContext.md` — product intent and UX
   - `systemPatterns.md` — architecture and conventions
   - `techContext.md` — stack and constraints
   - `progress.md` — done / pending / known issues
   - `activeContext.md` — current task and decisions

2. **During Act-mode work**, keep `activeContext.md` aligned with the current task (update when focus shifts).

3. **After meaningful milestones** (in Act mode), update `progress.md` and any affected docs in `{{BANK_PATH}}/`.

4. When the user asks to **update memory bank** (or similar), **open and review every** file in `{{BANK_PATH}}/`, then update what changed — especially `activeContext.md` and `progress.md`, even if other files are unchanged. Prefer doing heavy memory-bank writes in **Act mode** unless the user asked for documentation-only updates.

5. Prefer **short, factual updates** over long prose. Reference files, symbols, and tickets instead of duplicating code.

Do not delete these files; evolve them as the project changes.
