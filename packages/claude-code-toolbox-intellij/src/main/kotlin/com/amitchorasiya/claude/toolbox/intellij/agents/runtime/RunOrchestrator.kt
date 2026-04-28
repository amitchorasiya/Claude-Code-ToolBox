package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import com.amitchorasiya.claude.toolbox.intellij.agents.AgentEntry
import com.amitchorasiya.claude.toolbox.intellij.agents.TeamEntry
import com.amitchorasiya.claude.toolbox.intellij.agents.runtime.protocols.*
import com.intellij.openapi.diagnostic.logger
import java.io.File
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicBoolean

private val LOG = logger<RunOrchestrator>()

object RunOrchestrator {

    data class StartRunOptions(
        val team: TeamEntry,
        val agents: List<AgentEntry>,
        val userPrompt: String,
        val workspaceRoot: String? = null,
        val claudeBin: String? = null,
        val maxConcurrentAgents: Int = 3,
    )

    data class StartRunResult(
        val run: ActiveRun,
        val finished: CompletableFuture<FinishedRun>,
    )

    data class FinishedRun(val status: RunStatus, val planArtifactPath: String? = null)

    private fun sanitize(s: String): String = s.replace(Regex("[^a-z0-9._-]+", RegexOption.IGNORE_CASE), "-")

    private fun makeRunId(team: TeamEntry): String {
        val iso = java.time.Instant.now().toString().replace(":", "-").replace(".", "-")
        return "$iso-${sanitize(team.name)}"
    }

    fun startTeamRun(opts: StartRunOptions): StartRunResult {
        val runId = makeRunId(opts.team)
        val base = opts.workspaceRoot ?: System.getProperty("user.home")
        val runDir = File(base, ".claude/runs/$runId").absolutePath
        val jsonlPath = "$runDir/transcript.jsonl"
        val bus = RunBus(runId, jsonlPath)
        val abortFlag = AtomicBoolean(false)

        val active = ActiveRun(
            runId = runId, teamId = opts.team.id, teamName = opts.team.name,
            protocol = opts.team.protocol, runtime = opts.team.runtime,
            phase = "none", status = "running", startedAt = nowIso(),
            jsonlPath = jsonlPath, bus = bus, abortFlag = abortFlag,
        )
        RunRegistry.register(active)

        bus.emit(AgentRunEvent.RunStart(nowIso(), runId, opts.team.id, opts.team.name, opts.team.protocol, opts.team.runtime, "none"))
        bus.on { ev ->
            if (ev is AgentRunEvent.PhaseBoundary) {
                RunRegistry.update(runId) {
                    it.phase = ev.to
                    it.status = if (ev.needsApproval) "awaiting_approval" else "running"
                }
            }
        }

        val ctx = ProtocolContext(
            team = opts.team, agents = opts.agents, userPrompt = opts.userPrompt,
            bus = bus, runId = runId, cwd = opts.workspaceRoot, abortFlag = abortFlag,
            claudeBin = opts.claudeBin, runDir = runDir,
            awaitApproval = { planPath ->
                active.pendingApproval?.let { return@ProtocolContext it.planPath to null }
                var decision = "approve"
                var reason: String? = null
                val latch = java.util.concurrent.CountDownLatch(1)
                active.pendingApproval = PendingApproval(planPath) { d, r ->
                    decision = d; reason = r; latch.countDown()
                }
                latch.await()
                active.pendingApproval = null
                decision to reason
            },
        )

        val finished = CompletableFuture.supplyAsync {
            var status: RunStatus = "running"
            var planArtifactPath: String? = null
            var runTotals = RunUsage()
            try {
                val result = pickAndRunProtocol(ctx, opts)
                status = result.status
                planArtifactPath = result.planArtifactPath
                runTotals = result.totals
            } catch (e: Exception) {
                status = "error"
                bus.emit(AgentRunEvent.Error(nowIso(), runId, message = e.message ?: "unknown"))
                LOG.warn("Team run error", e)
            }
            bus.emit(AgentRunEvent.RunEnd(nowIso(), runId, status, runTotals))
            RunRegistry.update(runId) { it.status = status }
            bus.flush()
            FinishedRun(status, planArtifactPath)
        }

        return StartRunResult(active, finished)
    }

    private fun pickAndRunProtocol(ctx: ProtocolContext, opts: StartRunOptions): ProtocolResult {
        val mc = opts.maxConcurrentAgents
        return when (ctx.team.protocol) {
            "native-task" -> nativeTask(ctx)
            "round-robin" -> roundRobin(ctx)
            "handoff" -> handoff(ctx)
            "orchestrator" -> orchestrator(ctx)
            "parallel-fan-out" -> parallelFanout(ctx, mc)
            "debate" -> debate(ctx)
            "plan-then-code" -> planThenCode(ctx)
            "converge" -> converge(ctx, mc)
            else -> nativeTask(ctx)
        }
    }

    fun resolvePendingApproval(run: ActiveRun, decision: String, reason: String? = null): Boolean {
        val pending = run.pendingApproval ?: return false
        pending.resolve(decision, reason)
        return true
    }

    fun abortRun(run: ActiveRun) {
        run.abortFlag.set(true)
    }
}
