package com.amitchorasiya.claude.toolbox.intellij.cli

import com.intellij.openapi.application.PathManager
import java.net.JarURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.util.jar.JarFile

/**
 * Resolves the monorepo bridge CLIs shipped inside this plugin JAR (same sources as the VS Code
 * extension’s `node_modules` file deps — see [packages/cloude-code-toolbox/src/terminal/runEmbeddedToolboxCli.ts]).
 * IntelliJ does **not** use `npx` for these; npm registry packages are not required.
 */
enum class BundledBridgeCli(
    val packageDir: String,
    val cliFileName: String,
) {
    CURSOR_MCP_PORT("cursor-mcp-vscode-port", "cli.mjs"),
    CURSOR_RULES_TO_CLAUDE("cursor-rules-to-claude", "cli.js"),
    CLOUDE_CODE_MEMORY_BANK("cloude-code-memory-bank", "cli.mjs"),
}

object BundledBridgeCliRunner {

    private const val RESOURCE_PREFIX = "bridge-clis"
    private const val EXTRACT_VERSION = "1"

    private val lock = Any()

    fun resolveCliPath(cli: BundledBridgeCli): String {
        val rel = "${cli.packageDir}/bin/${cli.cliFileName}"
        val url = BundledBridgeCliRunner::class.java.classLoader.getResource("$RESOURCE_PREFIX/$rel")
            ?: error(
                "Bundled bridge CLI missing: $RESOURCE_PREFIX/$rel. " +
                    "Rebuild from the monorepo so prepareBridgeClis copies packages into the plugin.",
            )
        val packageRoot = when (url.protocol) {
            "file" -> {
                val p = Paths.get(url.toURI())
                p.parent.parent
            }
            "jar" -> {
                val dest = Paths.get(PathManager.getSystemPath(), "cloude-code-toolbox", "bundled-bridges-v$EXTRACT_VERSION")
                ensureAllBridgesExtracted(url, dest)
                dest.resolve(cli.packageDir)
            }
            else -> error("Unsupported bridge resource URL: $url")
        }
        return packageRoot.resolve("bin").resolve(cli.cliFileName).toString()
    }

    private fun ensureAllBridgesExtracted(anyEntryUrl: URL, dest: Path) {
        val stamp = dest.resolve(".extracted-v$EXTRACT_VERSION")
        synchronized(lock) {
            if (Files.isRegularFile(stamp)) {
                return
            }
            Files.createDirectories(dest)
            val conn = anyEntryUrl.openConnection() as JarURLConnection
            conn.useCaches = false
            val jar: JarFile = conn.jarFile
            extractBridgeTrees(jar, dest)
            Files.writeString(stamp, "ok")
        }
    }

    private fun extractBridgeTrees(jar: JarFile, dest: Path) {
        val prefix = "$RESOURCE_PREFIX/"
        val entries = jar.entries()
        while (entries.hasMoreElements()) {
            val e = entries.nextElement()
            if (e.isDirectory) {
                continue
            }
            if (!e.name.startsWith(prefix)) {
                continue
            }
            val rel = e.name.substring(prefix.length)
            val out = dest.resolve(rel)
            Files.createDirectories(out.parent)
            jar.getInputStream(e).use { inp ->
                Files.copy(inp, out, StandardCopyOption.REPLACE_EXISTING)
            }
        }
    }
}
