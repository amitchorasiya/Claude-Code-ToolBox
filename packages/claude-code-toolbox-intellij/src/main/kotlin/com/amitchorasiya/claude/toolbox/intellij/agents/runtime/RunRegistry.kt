package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import java.util.concurrent.ConcurrentHashMap

data class PendingApproval(
    val planPath: String,
    val resolve: (decision: String, reason: String?) -> Unit,
)

data class ActiveRun(
    val runId: String,
    val teamId: String,
    val teamName: String,
    val protocol: String,
    val runtime: String,
    var phase: RunPhase = "none",
    var status: RunStatus = "running",
    val startedAt: String,
    val jsonlPath: String,
    val bus: RunBus,
    val abortFlag: java.util.concurrent.atomic.AtomicBoolean = java.util.concurrent.atomic.AtomicBoolean(false),
    var pendingApproval: PendingApproval? = null,
)

object RunRegistry {
    private val runs = ConcurrentHashMap<String, ActiveRun>()

    fun register(run: ActiveRun) { runs[run.runId] = run }
    fun get(runId: String): ActiveRun? = runs[runId]
    fun listActive(): List<ActiveRun> = runs.values.filter { it.status == "running" || it.status == "awaiting_approval" }
    fun listAll(): List<ActiveRun> = runs.values.toList()

    fun update(runId: String, patch: (ActiveRun) -> Unit) {
        val r = runs[runId] ?: return
        patch(r)
    }

    fun clear(runId: String) { runs.remove(runId) }

    fun pruneTerminal() {
        runs.entries.removeAll { it.value.status in listOf("completed", "aborted", "error") }
    }
}
