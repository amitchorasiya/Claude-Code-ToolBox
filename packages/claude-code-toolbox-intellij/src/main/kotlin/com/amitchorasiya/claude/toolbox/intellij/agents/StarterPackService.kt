package com.amitchorasiya.claude.toolbox.intellij.agents

import java.nio.file.Files
import java.nio.file.Path

data class StarterAgent(val name: String, val description: String, val role: String, val body: String)

val SDLC_STARTER_AGENTS = listOf(
    StarterAgent("product-manager", "Clarifies user intent, shapes acceptance criteria, owns the brief.", "plan",
        "You are a product manager. Restate the user's intent, extract 3-7 testable acceptance criteria, and flag anything ambiguous. Be concise."),
    StarterAgent("architect", "Designs the approach, picks patterns, and gates the plan.", "plan",
        "You are a software architect. Given the PM's criteria, propose an implementation approach. List trade-offs, rejected alternatives, and open questions. Output a numbered plan."),
    StarterAgent("backend-dev", "Implements server-side code and APIs to match the approved plan.", "code",
        "You are a backend developer. Implement server-side changes that match the approved plan. Write clean, testable code. Flag any deviations from the plan."),
    StarterAgent("frontend-dev", "Implements UI and client-side logic to match the approved plan.", "code",
        "You are a frontend developer. Implement UI and client-side changes that match the approved plan. Follow existing component patterns. Flag any deviations."),
    StarterAgent("code-reviewer", "Reviews diffs, requests changes, approves at the end.", "review",
        "You are a code reviewer. Review the diff for correctness, readability, and adherence to existing patterns. Group findings as blocking / high / medium / low / nit. End with APPROVE or REQUEST_CHANGES."),
    StarterAgent("security-reviewer", "Threat-models plans and scans diffs for vulnerabilities.", "review",
        "You are a security reviewer. Evaluate for OWASP top-10 risks, secrets exposure, auth/authz gaps, injection vectors, and data handling. Propose one concrete mitigation per finding."),
    StarterAgent("qa-test-engineer", "Writes unit and integration tests for new features and regressions.", "code",
        "You are a QA/test engineer. Given the plan and implementation, write or update tests that cover the happy path and key edge cases. Specify the command to run them."),
)

fun installStarterAgents(scope: String, homeDir: Path, workspaceRoot: Path?): Pair<Int, Int> {
    val dir = agentsDirForScope(scope, homeDir, workspaceRoot) ?: return 0 to 0
    dir.toFile().mkdirs()
    var written = 0; var skipped = 0
    for (a in SDLC_STARTER_AGENTS) {
        val target = dir.resolve("${a.name}.md")
        if (target.toFile().exists()) { skipped++; continue }
        val md = listOf("---", "name: ${a.name}", "description: ${a.description}", "role: ${a.role}", "---", "", a.body, "").joinToString("\n")
        Files.writeString(target, md)
        written++
    }
    return written to skipped
}

data class SdlcCommand(val id: String, val description: String, val argumentHint: String, val requires: List<String>, val body: String, val defaultSelected: Boolean)

val SDLC_COMMANDS_PACK = listOf(
    SdlcCommand("plan-team", "Plan-phase team (product-manager → architect) produces a design recommendation.", "<what should the team plan?>", listOf("product-manager", "architect"), "You have access to these custom subagents. Use the **Task** tool to dispatch work to them, one at a time, in this order:\n\n1. `product-manager` — restate the user's intent and extract 3-7 testable acceptance criteria.\n2. `architect` — design the approach, flag trade-offs, list alternatives rejected.\n\nAfter both have replied, synthesize:\n- A short **Plan** section (numbered steps, each one-line).\n- Any **Open questions** the architect left unresolved.\n- Your recommended next action: `APPROVE / REVISE`.\n\nUser's request:\n\$ARGUMENTS", true),
    SdlcCommand("debate-team", "Multi-agent debate: architect vs security-reviewer with product-manager context.", "<topic or design decision>", listOf("product-manager", "architect", "security-reviewer"), "Run a short structured debate using the **Task** tool to dispatch these subagents in order:\n\n1. `product-manager` — frame the question.\n2. `architect` — argue the recommended approach.\n3. `security-reviewer` — push back with security concerns.\n4. `architect` — one-turn rebuttal.\n\nAfter all four turns, wrap the final verdict in `<decision>…</decision>` tags.\n\nTopic:\n\$ARGUMENTS", true),
    SdlcCommand("review-team", "Review the pending diff with code-reviewer then security-reviewer.", "<optional focus area>", listOf("code-reviewer", "security-reviewer"), "Run `git diff` first to capture the pending diff. Then use the **Task** tool to dispatch subagents sequentially:\n\n1. `code-reviewer` — review for correctness, readability.\n2. `security-reviewer` — second pass for OWASP, secrets, injection risks.\n\nCombine findings into: blocking / high / medium / low / nit.\nEnd with APPROVE or REQUEST_CHANGES.\n\nOptional focus area: \$ARGUMENTS", true),
    SdlcCommand("security-team", "Threat-model the user's change with security-reviewer only.", "<description of the change>", listOf("security-reviewer"), "Dispatch the `security-reviewer` subagent via the **Task** tool. Ask it to:\n\n1. Enumerate OWASP-relevant risks.\n2. Propose one concrete mitigation per risk.\n3. Flag anything needing compliance review.\n\nReturn the report as-is.\n\nChange description:\n\$ARGUMENTS", true),
    SdlcCommand("refactor-team", "Refactor coordinator: backend-dev + frontend-dev + qa-test-engineer + code-reviewer.", "<what to refactor and why>", listOf("backend-dev", "frontend-dev", "qa-test-engineer", "code-reviewer"), "Coordinate a refactor using the **Task** tool:\n\n1. `backend-dev` — list server-side changes.\n2. `frontend-dev` — list UI changes.\n3. `qa-test-engineer` — describe regression tests.\n4. `code-reviewer` — sanity-check the plan.\n\nOutput: ordered edit plan, test command, rollback plan.\n\nRefactor target:\n\$ARGUMENTS", false),
    SdlcCommand("spec-team", "Turn a rough idea into a spec: product-manager writes PRD, architect adds technical addendum.", "<feature idea>", listOf("product-manager", "architect"), "Build a spec using the **Task** tool:\n\n1. `product-manager` — write a concise PRD.\n2. `architect` — write a Technical addendum.\n\nReturn the combined document as markdown.\n\nIdea:\n\$ARGUMENTS", false),
)

fun installCommandsPack(selected: List<String>, scope: String, homeDir: Path, workspaceRoot: Path?, overwrite: Boolean = false): Pair<Int, Int> {
    val dir = commandsDirForScope(scope, homeDir, workspaceRoot) ?: return 0 to 0
    dir.toFile().mkdirs()
    var written = 0; var skipped = 0
    val selectedSet = selected.toSet()
    for (cmd in SDLC_COMMANDS_PACK) {
        if (cmd.id !in selectedSet) continue
        val target = dir.resolve("${cmd.id}.md")
        if (target.toFile().exists()) {
            if (!overwrite) { skipped++; continue }
            val existing = try { Files.readString(target) } catch (_: Exception) { "" }
            if (!existing.contains(COMMANDS_PACK_MARKER)) { skipped++; continue }
        }
        val md = listOf("---", "description: ${cmd.description}", "argument-hint: ${cmd.argumentHint}", "---", COMMANDS_PACK_MARKER, "", cmd.body.trim(), "").joinToString("\n")
        Files.writeString(target, md)
        written++
    }
    return written to skipped
}

fun commandsPackDefaultSelection(): List<String> = SDLC_COMMANDS_PACK.filter { it.defaultSelected }.map { it.id }
