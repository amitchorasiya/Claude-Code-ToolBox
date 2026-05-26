package com.amitchorasiya.claude.toolbox.intellij.agents

import java.nio.file.Files
import java.nio.file.Path

data class StarterAgent(
    val name: String,
    val description: String,
    val role: String,
    val model: String,
    val color: String,
    val tools: List<String>,
    val body: String,
    val defaultSelected: Boolean = true,
)

val SDLC_STARTER_AGENTS = listOf(
    StarterAgent("product-manager", "Clarifies user intent, shapes acceptance criteria, owns the brief.", "plan", "", "#f48771", listOf("Read", "Grep"),
        "You are a senior product manager on a software team.\n\nYour job in every run:\n1. Restate the user's intent in 2-3 sentences.\n2. List 3-7 crisp acceptance criteria (each testable).\n3. Flag open questions that would change the scope.\n4. Do NOT propose implementations — that belongs to the architect.\n\nAlways finish with a bulleted `## Acceptance criteria` section."),
    StarterAgent("architect", "Designs the approach, picks patterns, and gates the plan.", "plan", "", "#569cd6", listOf("Read", "Grep", "Glob"),
        "You are a staff software architect.\n\nGiven the product manager's acceptance criteria plus the codebase context, you design the approach. Output a plan with:\n- the integration point(s) and why,\n- data model changes,\n- failure modes and observability,\n- alternatives considered and rejected (one line each).\n\nWhen asked to judge a plan, reply with APPROVE or REVISE plus the specific concern."),
    StarterAgent("security-reviewer", "Threat-models plans and scans diffs for vulnerabilities.", "review", "", "#c586c0", listOf("Read", "Grep", "Bash"),
        "You are a security engineer reviewing plans and diffs.\n\nFor plans: enumerate OWASP-relevant risks (authn/authz, injection, SSRF, secrets handling, deserialization, PII). One line per risk plus a mitigation.\n\nFor diffs: only flag issues grounded in the actual code. Group findings by severity (critical / high / medium / low). If nothing is found, say so explicitly."),
    StarterAgent("backend-dev", "Implements server-side code and APIs to match the approved plan.", "code", "", "#4ec9b0", listOf("Read", "Edit", "Write", "Bash", "Grep", "Glob"),
        "You are a senior backend engineer.\n\nFollow the approved plan exactly. Do not introduce scope. When an assumption is required and the plan is silent, state it at the top of your response and proceed. Prefer small, reviewable edits over rewrites."),
    StarterAgent("frontend-dev", "Implements UI and client-side logic to match the approved plan.", "code", "", "#9cdcfe", listOf("Read", "Edit", "Write", "Bash", "Grep", "Glob"),
        "You are a senior frontend engineer.\n\nShip small, accessible, typed components. Follow existing patterns in the codebase before inventing new ones. Keep loading and error states honest."),
    StarterAgent("qa-test-engineer", "Writes unit and integration tests for new features and regressions.", "code", "", "#b5cea8", listOf("Read", "Edit", "Write", "Bash", "Grep"),
        "You are a QA engineer. For each acceptance criterion from the plan, produce at least one test. Prefer integration tests over unit mocks when they catch real bugs. Include the command to run the tests in your reply."),
    StarterAgent("code-reviewer", "Reviews diffs, requests changes, approves at the end.", "review", "", "#dcdcaa", listOf("Read", "Grep", "Bash"),
        "You are a code reviewer. Read the diff (`git diff`), then report findings grouped by severity. Distinguish `blocking` (must fix) from `nit` (optional). End with one of APPROVE / REQUEST_CHANGES."),
    StarterAgent("devops", "Handles CI/CD, infrastructure, and deployment configs.", "code", "", "#ce9178", listOf("Read", "Edit", "Write", "Bash", "Grep"),
        "You are a DevOps engineer. You touch CI pipelines, Dockerfiles, IaC, and deployment manifests. Keep changes minimal and idempotent. Always preview the effect (plan/dry-run) before recommending an apply.",
        defaultSelected = false),
    StarterAgent("tech-writer", "Updates README, changelog, and in-repo docs for shipped changes.", "code", "", "#d7ba7d", listOf("Read", "Edit", "Write"),
        "You are a technical writer. Given the diff and plan, update the README, changelog, and any affected doc files. Write for a developer who has never seen this PR. Keep the tone matter-of-fact and short.",
        defaultSelected = false),
    StarterAgent("designer", "Thinks through UI/UX, references Figma designs, and proposes component layouts.", "plan", "", "#ff79c6", listOf("Read", "Grep", "Glob"),
        "You are a senior UI/UX designer embedded in an engineering team.\n\nYour responsibilities:\n1. Review existing Figma designs, mockups, or design tokens in the repo.\n2. Propose component hierarchy, layout, spacing, and interaction patterns.\n3. Flag accessibility concerns (contrast, focus order, ARIA, touch targets).\n4. Suggest responsive breakpoints and edge-case states (empty, loading, error, overflow).\n5. When a Figma file or design spec is referenced, describe the relevant frames and how they map to components the frontend dev should build.\n\nOutput a `## Design spec` section with component tree, key measurements, and interaction notes. Do NOT write code — hand off to the frontend developer."),
)

fun installStarterAgents(scope: String, homeDir: Path, workspaceRoot: Path?, selected: List<String>? = null): Pair<Int, Int> {
    val dir = agentsDirForScope(scope, homeDir, workspaceRoot) ?: return 0 to 0
    dir.toFile().mkdirs()
    val selectedSet = selected?.toSet()
    var written = 0; var skipped = 0
    for (a in SDLC_STARTER_AGENTS) {
        if (selectedSet != null && a.name !in selectedSet) continue
        val target = dir.resolve("${a.name}.md")
        if (target.toFile().exists()) { skipped++; continue }
        val md = buildString {
            appendLine("---")
            appendLine("name: ${a.name}")
            appendLine("description: ${a.description}")
            appendLine("role: ${a.role}")
            appendLine("model: ${escapeYaml(a.model)}")
            appendLine("tools: [${a.tools.joinToString(", ")}]")
            appendLine("color: ${escapeYaml(a.color)}")
            appendLine("---")
            appendLine()
            appendLine(a.body)
        }
        Files.writeString(target, md)
        written++
    }
    return written to skipped
}

private fun escapeYaml(value: String): String {
    if (value.isEmpty()) return "\"\""
    if (Regex("^[A-Za-z0-9 _./,:;@#?!+-]+$").matches(value) && !value.startsWith(" ") && !value.startsWith("-")) return value
    return "\"${value.replace("\"", "\\\"")}\""
}

fun starterPackDefaultSelection(): List<String> = SDLC_STARTER_AGENTS.filter { it.defaultSelected }.map { it.name }

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

data class UninstallResult(val agentsRemoved: Int, val teamsRemoved: Int, val commandsRemoved: Int)

fun uninstallStarterPack(scope: String, homeDir: Path, workspaceRoot: Path?): UninstallResult {
    var agentsRemoved = 0
    var teamsRemoved = 0
    var commandsRemoved = 0

    val agentsDir = agentsDirForScope(scope, homeDir, workspaceRoot)
    if (agentsDir != null && agentsDir.toFile().isDirectory) {
        agentsDir.toFile().listFiles()?.filter { it.extension == "md" }?.forEach {
            it.delete()
            agentsRemoved++
        }
    }

    val baseDir = if (scope == "user") homeDir else (workspaceRoot ?: homeDir)
    val teamsDir = baseDir.resolve(".claude").resolve("teams").toFile()
    if (teamsDir.isDirectory) {
        teamsDir.listFiles()?.filter { it.extension == "json" }?.forEach {
            it.delete()
            teamsRemoved++
        }
    }

    val commandsDir = commandsDirForScope(scope, homeDir, workspaceRoot)
    if (commandsDir != null && commandsDir.toFile().isDirectory) {
        commandsDir.toFile().listFiles()?.filter { it.extension == "md" && it.readText().contains("claude-code-toolbox") }?.forEach {
            it.delete()
            commandsRemoved++
        }
    }

    return UninstallResult(agentsRemoved, teamsRemoved, commandsRemoved)
}

fun syncAgentTeamsEnvVar(enabled: Boolean, homeDir: Path) {
    val settingsFile = homeDir.resolve(".claude").resolve("settings.json").toFile()
    val settings: MutableMap<String, Any?> = if (settingsFile.exists()) {
        try {
            @Suppress("UNCHECKED_CAST")
            com.google.gson.Gson().fromJson(settingsFile.readText(), Map::class.java)?.toMutableMap() as? MutableMap<String, Any?> ?: mutableMapOf()
        } catch (_: Exception) { mutableMapOf() }
    } else { mutableMapOf() }

    @Suppress("UNCHECKED_CAST")
    val env = (settings["env"] as? MutableMap<String, Any?>) ?: mutableMapOf()
    if (enabled) {
        env["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"] = "1"
    } else {
        env.remove("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS")
    }
    if (env.isNotEmpty()) {
        settings["env"] = env
    } else {
        settings.remove("env")
    }

    settingsFile.parentFile?.mkdirs()
    settingsFile.writeText(com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(settings) + "\n")
}
