# Release v1.0.11 / v0.6.12

**Release Date:** April 17, 2026  
**VS Code Extension:** v1.0.11  
**IntelliJ Plugin:** v0.6.12

## Summary

Maintenance release with dependency updates and improved compatibility for the IntelliJ plugin. This release addresses plugin verification warnings and ensures compatibility with IntelliJ IDEA 2024.2 through 2026.1.

## Changes

### VS Code Extension (v1.0.11)

**Package:** `cloude-code-toolbox-vscode-1.0.11.vsix` (435 KB)

- No functional changes
- Version bump to maintain sync with IntelliJ plugin
- Updated README with new version numbers

### IntelliJ Plugin (v0.6.12)

**Package:** `cloude-code-toolbox-intellij-0.6.12.zip` (2.3 MB)

#### Dependency Updates

- **Kotlin:** 2.1.10 → 2.1.21
  - Addresses reflection compatibility warnings with Java 21+
  - Prepares for Kotlin 2.2.0 which fully resolves `TypeVariableImpl.getAnnotatedBounds()` issue
  
- **Gson:** 2.11.0 → 2.12.1
  - Updates to latest stable version
  - Reduces deprecated API usage warnings

#### Plugin Verification

✅ Verified against 6 IntelliJ IDEA versions:
- IntelliJ IDEA 2024.2 (IU-242.26775.15)
- IntelliJ IDEA 2024.3 (IU-243.28141.18)
- IntelliJ IDEA 2025.1 (IU-251.29188.11)
- IntelliJ IDEA 2025.2 (IU-252.28539.33)
- IntelliJ IDEA 2025.3 (IU-253.32098.37)
- IntelliJ IDEA 2026.1 (IU-261.23567.71)

**Verification Results:**
- ✅ Build successful
- ✅ No invalid plugin structure issues
- ✅ No missing dependencies
- ✅ Library layout correct (Gson properly separated)
- ⚠️  Expected third-party library warnings (non-functional)

See [VERIFICATION_REPORT.md](packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md) for detailed verification results.

## Installation

### VS Code

#### From VSIX
```bash
code --install-extension packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix
```

#### From Marketplace
Search for **Claude Code ToolBox** or use:
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.cloude-code-toolbox-vscode)
- Extension ID: `amitchorasiya.cloude-code-toolbox-vscode`

### JetBrains (IntelliJ IDEA, PyCharm, etc.)

#### From ZIP
1. Open IDE Settings → Plugins
2. Click ⚙️ → Install Plugin from Disk
3. Select `packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip`

#### From Marketplace
- [Search JetBrains Marketplace](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox)
- Plugin ID: `com.amitchorasiya.claude.code.toolbox`
- Or use deep link: `jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.claude.code.toolbox`

## Build Information

### VS Code Build
```bash
npm run package
```
**Output:** `packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix`

### IntelliJ Build
```bash
npm run package:intellij
# or directly:
cd packages/claude-code-toolbox-intellij && ./gradlew buildPlugin
```
**Output:** `packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip`

## Known Issues

### IntelliJ Plugin
- **Kotlin stdlib reflection warnings** (non-critical): `TypeVariableImpl` missing `getAnnotatedBounds()` on Java 21+. This is a known Kotlin stdlib issue that doesn't affect plugin functionality and will be resolved in Kotlin 2.2.0+.
- **Deprecated API warnings** from third-party libraries (Gson, Kotlin stdlib). These are warnings only and don't affect functionality.

See [VERIFICATION_REPORT.md](packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md) for complete details.

## Files

### VS Code Extension
- **Package:** [packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix](packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix)
- **Size:** 435 KB
- **Files:** 233 files

### IntelliJ Plugin
- **Package:** [packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip](packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip)
- **Size:** 2.3 MB
- **Verified Against:** IntelliJ IDEA 2024.2 - 2026.1

## Links

- **Repository:** https://github.com/amitchorasiya/Claude-Code-ToolBox
- **VS Code Marketplace:** https://marketplace.visualstudio.com/items?itemName=amitchorasiya.cloude-code-toolbox-vscode
- **JetBrains Marketplace:** https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox
- **Documentation:** [README.md](README.md)
- **Changelog:** [packages/claude-code-toolbox/CHANGELOG.md](packages/claude-code-toolbox/CHANGELOG.md)
- **Verification Report:** [packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md](packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md)

## License

MIT - See [LICENSE](LICENSE) file for details.
