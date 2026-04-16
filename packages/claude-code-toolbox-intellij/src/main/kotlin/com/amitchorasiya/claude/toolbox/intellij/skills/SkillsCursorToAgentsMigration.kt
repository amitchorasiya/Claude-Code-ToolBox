package com.amitchorasiya.claude.toolbox.intellij.skills

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.Comparator
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.streams.toList

enum class MigrateSkillMode { COPY, MOVE }

data class ScopeRun(
    val skillsSourcePath: String,
    val found: Int,
    val migrated: Int,
    val skipped: Int,
    val errors: Int,
)

/**
 * Mirrors [packages/cloude-code-toolbox/src/skills/migrateCursorSkillsToAgents.ts] for `.cursor/skills` → `.agents/skills`,
 * plus Copilot/GitHub paths (`.github/skills`, `~/.copilot/skills`).
 */
object SkillsCursorToAgentsMigration {

    private val CURSOR_SEGS = listOf(".cursor", "skills")
    /** Workspace `.github/skills` (Copilot/GitHub layout). */
    val GITHUB_SKILLS_SEGS = listOf(".github", "skills")
    /** User `~/.copilot/skills`. */
    val COPILOT_USER_SKILLS_SEGS = listOf(".copilot", "skills")
    private val AGENTS_SEGS = listOf(".agents", "skills")

    fun runForRoot(base: Path, mode: MigrateSkillMode): ScopeRun =
        runForRootWithSegments(base, CURSOR_SEGS, mode)

    fun runForGithubSkillsRoot(base: Path, mode: MigrateSkillMode): ScopeRun =
        runForRootWithSegments(base, GITHUB_SKILLS_SEGS, mode)

    fun runForUserCopilotSkills(home: Path, mode: MigrateSkillMode): ScopeRun =
        runForRootWithSegments(home, COPILOT_USER_SKILLS_SEGS, mode)

    fun runForRootWithSegments(base: Path, skillPathSegments: List<String>, mode: MigrateSkillMode): ScopeRun {
        var p = base
        for (s in skillPathSegments) {
            p = p.resolve(s)
        }
        val skillsRoot = p
        if (!skillsRoot.exists() || !skillsRoot.isDirectory()) {
            return ScopeRun(skillsRoot.toString(), 0, 0, 0, 0)
        }
        var agentsRoot = base
        for (s in AGENTS_SEGS) {
            agentsRoot = agentsRoot.resolve(s)
        }
        Files.createDirectories(agentsRoot)
        val folders = listSkillFolders(skillsRoot)
        var migrated = 0
        var skipped = 0
        var errors = 0
        for (f in folders) {
            val dest = agentsRoot.resolve(f.fileName)
            when (migrateOne(f, dest, mode)) {
                MigrateOneResult.MIGRATED -> migrated++
                MigrateOneResult.SKIPPED -> skipped++
                MigrateOneResult.ERROR -> errors++
            }
        }
        return ScopeRun(skillsRoot.toString(), folders.size, migrated, skipped, errors)
    }

    private enum class MigrateOneResult { MIGRATED, SKIPPED, ERROR }

    private fun listSkillFolders(skillsRoot: Path): List<Path> {
        if (!Files.isDirectory(skillsRoot)) return emptyList()
        return try {
            Files.list(skillsRoot).use { stream ->
                stream.filter { Files.isDirectory(it) && Files.isRegularFile(it.resolve("SKILL.md")) }
                    .toList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun migrateOne(src: Path, dest: Path, mode: MigrateSkillMode): MigrateOneResult {
        if (!Files.exists(dest)) {
            return try {
                copyRecursive(src, dest)
                if (mode == MigrateSkillMode.MOVE) {
                    deleteRecursive(src)
                }
                MigrateOneResult.MIGRATED
            } catch (_: Exception) {
                MigrateOneResult.ERROR
            }
        }
        val copied = mergeSkillFolderAddOnly(src, dest)
        return when {
            copied.isEmpty() -> MigrateOneResult.SKIPPED
            mode == MigrateSkillMode.MOVE -> {
                unlinkRelUnder(src, copied)
                pruneEmptyDirsUnder(src)
                MigrateOneResult.MIGRATED
            }
            else -> MigrateOneResult.MIGRATED
        }
    }

    /** Copy missing files from [srcRoot] into [destRoot] (add-only). Returns relative paths (posix) created under dest. */
    private fun mergeSkillFolderAddOnly(srcRoot: Path, destRoot: Path): List<String> {
        val out = mutableListOf<String>()
        if (!Files.isDirectory(srcRoot)) return out
        Files.walk(srcRoot).use { stream ->
            stream.filter { Files.isRegularFile(it) }.forEach { file ->
                val rel = srcRoot.relativize(file).toString().replace('\\', '/')
                val target = destRoot.resolve(srcRoot.relativize(file))
                if (!Files.exists(target)) {
                    Files.createDirectories(target.parent)
                    Files.copy(file, target, StandardCopyOption.REPLACE_EXISTING)
                    out.add(rel)
                }
            }
        }
        return out
    }

    private fun unlinkRelUnder(root: Path, relPaths: List<String>) {
        for (rel in relPaths) {
            val p = rel.split('/').fold(root) { acc, part -> acc.resolve(part) }
            try {
                Files.deleteIfExists(p)
            } catch (_: Exception) {
            }
        }
    }

    private fun pruneEmptyDirsUnder(root: Path) {
        try {
            Files.walk(root).use { stream ->
                stream.sorted(Comparator.reverseOrder()).forEach { p ->
                    if (p != root && Files.isDirectory(p)) {
                        try {
                            val entries = Files.list(p).use { it.toList() }
                            if (entries.isEmpty()) Files.deleteIfExists(p)
                        } catch (_: Exception) {
                        }
                    }
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun copyRecursive(src: Path, dest: Path) {
        Files.walk(src).use { stream ->
            stream.forEach { p ->
                val rel = src.relativize(p)
                val target = dest.resolve(rel.toString())
                if (Files.isDirectory(p)) {
                    Files.createDirectories(target)
                } else {
                    Files.createDirectories(target.parent)
                    Files.copy(p, target, StandardCopyOption.REPLACE_EXISTING)
                }
            }
        }
    }

    private fun deleteRecursive(root: Path) {
        if (!Files.exists(root)) return
        Files.walk(root).use { stream ->
            stream.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) }
        }
    }
}
