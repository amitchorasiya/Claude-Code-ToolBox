package com.amitchorasiya.claude.toolbox.intellij.agents.runtime

import com.google.gson.Gson
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

typealias RunBusListener = (AgentRunEvent) -> Unit

class RunBus(val runId: String, val jsonlPath: String) {
    private val listeners = CopyOnWriteArrayList<RunBusListener>()
    private val ended = AtomicBoolean(false)
    private val writeQueue = LinkedBlockingQueue<AgentRunEvent>()
    private val gson = Gson()

    @Volatile
    private var writerThread: Thread? = null

    init {
        writerThread = Thread({
            while (true) {
                val event = try { writeQueue.take() } catch (_: InterruptedException) { break }
                appendJsonLine(event)
                if (event is AgentRunEvent.RunEnd) break
            }
        }, "RunBus-writer-$runId").apply { isDaemon = true; start() }
    }

    fun on(listener: RunBusListener): () -> Unit {
        listeners.add(listener)
        return { listeners.remove(listener) }
    }

    fun emit(event: AgentRunEvent) {
        if (ended.get() && event !is AgentRunEvent.RunEnd) return
        if (event is AgentRunEvent.RunEnd) ended.set(true)
        for (l in listeners) {
            try { l(event) } catch (_: Exception) {}
        }
        writeQueue.offer(event)
    }

    fun flush() {
        while (writeQueue.isNotEmpty()) Thread.sleep(10)
    }

    private fun appendJsonLine(event: AgentRunEvent) {
        try {
            val dir = File(jsonlPath).parentFile
            if (!dir.exists()) dir.mkdirs()
            File(jsonlPath).appendText(gson.toJson(event.toJson()) + "\n")
        } catch (_: Exception) {}
    }
}
