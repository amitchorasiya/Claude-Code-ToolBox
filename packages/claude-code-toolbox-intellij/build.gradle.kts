import java.util.jar.JarInputStream
import java.util.zip.ZipFile
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease

plugins {
    kotlin("jvm") version "2.1.21"
    id("org.jetbrains.intellij.platform") version "2.13.1"
}

group = "com.amitchorasiya.claude"
version = "0.6.18"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

// Do not repackage Maven/JAR dependencies into the main plugin JAR (no Shadow, no fat-jar merge).
// The IntelliJ Platform Gradle Plugin emits separate JARs under lib/; Plugin Verifier expects that layout.
// https://plugins.jetbrains.com/docs/intellij/plugin-content.html
dependencies {
    intellijPlatform {
        intellijIdea("2024.3")
    }
    implementation("com.google.code.gson:gson:2.12.1")
    testImplementation(kotlin("test"))
    // IntelliJ JUnit5 initializer expects JUnit 4 API on the classpath (TestRule).
    testImplementation("junit:junit:4.13.2")
}

val monorepoPackagesDir = rootDir.parentFile

val copyBridgeCursorMcpPort = tasks.register<Copy>("copyBridgeCursorMcpPort") {
    group = "build"
    description = "Stage cursor-mcp-vscode-port into plugin resources (same sources as VS Code extension)."
    from(monorepoPackagesDir.resolve("cursor-mcp-vscode-port")) {
        include("bin/**", "lib/**", "package.json", "README.md")
    }
    into(layout.buildDirectory.dir("generated-resources/bridge-clis/cursor-mcp-vscode-port"))
}

val copyBridgeMemoryBank = tasks.register<Copy>("copyBridgeMemoryBank") {
    group = "build"
    description = "Stage claude-code-memory-bank into plugin resources."
    from(monorepoPackagesDir.resolve("claude-code-memory-bank")) {
        include("bin/**", "lib/**", "templates/**", "package.json", "README.md", "LICENSE", "NOTICE")
    }
    into(layout.buildDirectory.dir("generated-resources/bridge-clis/claude-code-memory-bank"))
}

val copyBridgeCursorRules = tasks.register<Copy>("copyBridgeCursorRules") {
    group = "build"
    description = "Stage cursor-rules-to-claude into plugin resources."
    from(monorepoPackagesDir.resolve("cursor-rules-to-claude")) {
        include("bin/**", "lib/**", "package.json", "README.md")
    }
    into(layout.buildDirectory.dir("generated-resources/bridge-clis/cursor-rules-to-claude"))
}

val npmInstallRulesBridge = tasks.register<Exec>("npmInstallRulesBridge") {
    group = "build"
    description = "npm install --production for cursor-rules-to-claude (gray-matter dependency)."
    dependsOn(copyBridgeCursorRules)
    workingDir(layout.buildDirectory.dir("generated-resources/bridge-clis/cursor-rules-to-claude").get().asFile)
    commandLine("npm", "install", "--production", "--no-audit", "--no-fund")
}

val prepareBridgeClis = tasks.register("prepareBridgeClis") {
    group = "build"
    description = "Copy monorepo bridge CLIs into generated-resources for the plugin JAR."
    dependsOn(copyBridgeCursorMcpPort, copyBridgeMemoryBank, npmInstallRulesBridge)
}

sourceSets {
    named("main") {
        resources.srcDir(layout.buildDirectory.dir("generated-resources"))
    }
}

kotlin {
    jvmToolchain(21)
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "242"
        }
    }
    // Verify against IntelliJ IDEA only. Do not use recommended() — it includes DataSpell and other
    // products; Marketplace verification currently fails DS with "Product DS is not supported yet"
    // (verifier/license), while IDEA rows succeed.
    pluginVerification {
        ides {
            select {
                types = listOf(IntelliJPlatformType.IntellijIdea)
                channels = listOf(ProductRelease.Channel.RELEASE, ProductRelease.Channel.EAP)
                sinceBuild = "242"
                // Open upper bound — match active IDEA releases (incl. 2026.x); use NNN.* if you need a cap.
                untilBuild = "999.*"
            }
        }
    }
    // Token from gradle.properties or -P / ORG_GRADLE_PROJECT_* (see publishing-plugin.html).
    publishing {
        token = providers.gradleProperty("intellijPlatformPublishingToken")
    }
}

val verifyPluginLibraryLayout = tasks.register("verifyPluginLibraryLayout") {
    group = "verification"
    description =
        "Ensures bundled libraries (e.g. Gson) are not merged into the main plugin JAR (Plugin Verifier / Marketplace)."
    notCompatibleWithConfigurationCache("Reads the built plugin ZIP from disk in doLast.")
    dependsOn("buildPlugin")
    val pluginVersion = project.version.toString()
    doLast {
        val distDir = layout.buildDirectory.dir("distributions").get().asFile
        val all = distDir.listFiles { f -> f.isFile && f.extension == "zip" }?.toList().orEmpty()
        val ver = pluginVersion
        val zipFile = all.filter { it.name.contains(ver) }.maxByOrNull { it.lastModified() }
            ?: all.maxByOrNull { it.lastModified() }
            ?: error("No plugin ZIP in $distDir")
        check(all.isNotEmpty()) {
            "Expected at least one plugin ZIP in $distDir"
        }
        ZipFile(zipFile).use { zf ->
            val entries = zf.entries()
            var mainJar: java.util.zip.ZipEntry? = null
            while (entries.hasMoreElements()) {
                val e = entries.nextElement()
                if (e.isDirectory || !e.name.endsWith(".jar") || !e.name.contains("/lib/")) continue
                val isMain = zf.getInputStream(e).use { ins ->
                    JarInputStream(ins).use { jis ->
                        while (true) {
                            val je = jis.nextJarEntry ?: break
                            if (je.name == "META-INF/plugin.xml") return@use true
                        }
                        false
                    }
                }
                if (isMain) {
                    mainJar = e
                    break
                }
            }
            val mainEntry = mainJar ?: error("Could not locate main plugin JAR (META-INF/plugin.xml) in $zipFile")
            zf.getInputStream(mainEntry).use { ins ->
                JarInputStream(ins).use { jis ->
                    while (true) {
                        val je = jis.nextJarEntry ?: break
                        val name = je.name
                        check(
                            !(name.startsWith("com/google/gson/") && name.endsWith(".class"))
                        ) {
                            "Gson must not be repackaged into the main plugin JAR ($name). " +
                                "Keep libraries as sibling JARs under lib/. See " +
                                "https://plugins.jetbrains.com/docs/intellij/plugin-content.html"
                        }
                    }
                }
            }
        }
    }
}

tasks {
    named<ProcessResources>("processResources") {
        dependsOn(prepareBridgeClis)
    }

    buildPlugin {
        finalizedBy("verifyPluginLibraryLayout")
    }

    // Keep all searchable-options tasks off together; otherwise `clean` removes tmp output and
    // prepareJarSearchableOptions fails (buildSearchableOptions is skipped so the dir is never recreated).
    buildSearchableOptions {
        enabled = false
    }
    prepareJarSearchableOptions {
        enabled = false
    }
    jarSearchableOptions {
        enabled = false
    }
    test {
        useJUnitPlatform()
    }

    // Note: verifyPlugin will report Kotlin stdlib compatibility warnings on Java 21+
    // This is a known issue (TypeVariableImpl missing getAnnotatedBounds()) that will be
    // fixed in Kotlin 2.2.0+. The warnings don't affect plugin functionality.
    // To run verification and review reports: ./gradlew verifyPlugin || true
    // Reports are in build/reports/pluginVerifier/
}
