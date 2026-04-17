# Release Packages v1.0.11 / v0.6.12

**Build Date:** April 17, 2026 - 14:02 (Final)  
**Status:** ✅ Ready for Distribution

## Package Details

### VS Code Extension

**File:** `cloude-code-toolbox-vscode-1.0.11.vsix`  
**Location:** `packages/claude-code-toolbox/`  
**Size:** 435 KB  
**Files:** 233 files  
**Version:** 1.0.11

**Contents:**
- Extension code (TypeScript compiled to JavaScript)
- Bridge CLIs (cursor-mcp-vscode-port, memory-bank, cursor-rules-to-claude)
- Resources and icons
- README with updated screenshots (cache-busted to v=1.0.11)
- CHANGELOG with v1.0.11 entry

**Changes in this build:**
- ✅ Updated README with latest screenshots
- ✅ Removed reference to non-existent screenshot  
- ✅ Updated cache-busting parameters (?v=1.0.11)
- ✅ Version bumped from 1.0.10 to 1.0.11
- ✅ CHANGELOG updated with dependency update notes
- ✅ Package README includes updated screenshots with cache-busting

### IntelliJ Plugin

**File:** `cloude-code-toolbox-intellij-0.6.12.zip`  
**Location:** `packages/claude-code-toolbox-intellij/build/distributions/`  
**Size:** 2.3 MB  
**Version:** 0.6.12

**Contents:**
- Plugin JAR with Kotlin code
- Gson library (separate JAR, not merged)
- Bridge CLIs (same as VS Code)
- Plugin metadata and resources

**Changes in this build:**
- ✅ Kotlin updated: 2.1.10 → 2.1.21
- ✅ Gson updated: 2.11.0 → 2.12.1
- ✅ Version bumped from 0.6.11 to 0.6.12
- ✅ Plugin verified against IntelliJ IDEA 2024.2 through 2026.1
- ✅ Verification report included (VERIFICATION_REPORT.md)
- ✅ README updated with version 0.6.12 and cache-busted screenshots

## Build Commands

### VS Code
```bash
# From repository root
npm run package

# Output
packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix
```

### IntelliJ
```bash
# From repository root
npm run package:intellij

# Or directly in plugin directory
cd packages/claude-code-toolbox-intellij
./gradlew clean buildPlugin

# Output
packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip
```

## Installation

### VS Code

**Option 1: From VSIX (Local Install)**
```bash
code --install-extension packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix
```

**Option 2: From Marketplace**
- Search: **Claude Code ToolBox**
- Extension ID: `amitchorasiya.cloude-code-toolbox-vscode`
- [Direct link](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.cloude-code-toolbox-vscode)

### IntelliJ (and other JetBrains IDEs)

**Option 1: From ZIP (Local Install)**
1. Open IDE Settings → Plugins
2. Click ⚙️ (gear icon) → **Install Plugin from Disk...**
3. Select: `packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip`
4. Restart IDE when prompted

**Option 2: From JetBrains Marketplace**
- Search: **Claude Code ToolBox**
- Plugin ID: `com.amitchorasiya.claude.code.toolbox`
- [Search Marketplace](https://plugins.jetbrains.com/search?search=Claude+Code+ToolBox)
- [Deep link](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.claude.code.toolbox)

## Verification

### VS Code Package
```bash
# List contents
unzip -l packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix

# Check version in manifest
unzip -p packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix extension/package.json | grep '"version"'
```

### IntelliJ Package
```bash
# List contents
unzip -l packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip

# Check for separate Gson JAR (should be lib/gson-*.jar, not merged)
unzip -l packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip | grep gson
```

## What's Included

Both packages include:

### Common Features
- ✅ MCP hub with browse, search, and install capabilities
- ✅ Skills catalog integration (skills.sh)
- ✅ Cursor → Claude Code migration tools
- ✅ Memory bank scaffolding
- ✅ Workspace checklist
- ✅ Context pack and readiness tools
- ✅ Bridge CLIs for automated tasks

### VS Code Specific
- Activity Bar icon and Side Bar panel
- VS Code settings integration
- Webview-based hub UI
- VS Code command palette integration

### IntelliJ Specific
- Tool window integration
- JetBrains settings integration
- JCEF-based hub UI
- IntelliJ action system integration

## Quality Checks Passed

### VS Code Extension
- ✅ TypeScript compilation successful
- ✅ No TypeScript errors
- ✅ Package size: 435 KB (reasonable)
- ✅ 233 files packaged
- ✅ README cache-busting updated
- ✅ All screenshots referenced exist

### IntelliJ Plugin
- ✅ Kotlin compilation successful
- ✅ Gradle build successful
- ✅ Plugin structure verified (verifyPluginLibraryLayout passed)
- ✅ Gson correctly separated (not merged into main JAR)
- ✅ Verified against 6 IntelliJ IDEA versions (2024.2 - 2026.1)
- ✅ No critical compatibility issues
- ✅ All expected warnings documented

## Known Issues

### IntelliJ Plugin (Non-Critical)
- **Kotlin stdlib reflection warning**: `TypeVariableImpl` missing `getAnnotatedBounds()` on Java 21+
  - **Impact:** None - doesn't affect plugin functionality
  - **Resolution:** Will be fixed in Kotlin 2.2.0+
  - **Details:** See [VERIFICATION_REPORT.md](packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md)

### VS Code Extension
- **Bundling recommendation**: Extension could be bundled for better performance
  - **Impact:** Minor - slightly slower startup
  - **Status:** Acceptable for current release

## Distribution Checklist

- [x] VS Code package built (1.0.11)
- [x] IntelliJ package built (0.6.12)
- [x] READMEs updated with latest screenshots
- [x] Website updated with latest screenshots
- [x] CHANGELOG updated
- [x] Version numbers incremented
- [x] Verification report created (IntelliJ)
- [x] Build successful for both packages
- [x] Package sizes verified
- [x] Dependencies updated (IntelliJ: Kotlin 2.1.21, Gson 2.12.1)

## Next Steps

1. **Test Installation**
   - Install VS Code VSIX locally and verify functionality
   - Install IntelliJ ZIP locally and verify functionality

2. **Publish to Marketplaces**
   - VS Code Marketplace: `vsce publish` (requires publisher token)
   - JetBrains Marketplace: Upload ZIP via plugin portal

3. **Tag Release**
   ```bash
   git tag -a v1.0.11 -m "Release v1.0.11 / v0.6.12"
   git push origin v1.0.11
   ```

4. **Create GitHub Release**
   - Attach both packages
   - Include release notes from RELEASE-1.0.11.md

## Related Documentation

- [RELEASE-1.0.11.md](RELEASE-1.0.11.md) - Full release notes
- [SCREENSHOT-UPDATE.md](SCREENSHOT-UPDATE.md) - Screenshot update details
- [packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md](packages/claude-code-toolbox-intellij/VERIFICATION_REPORT.md) - IntelliJ verification details
- [packages/claude-code-toolbox/CHANGELOG.md](packages/claude-code-toolbox/CHANGELOG.md) - Version history
- [README.md](README.md) - Main project documentation

## Package Hashes

For verification purposes (SHA256):

```
VS Code Extension:
917d1c4e8a9ca8047569e1a0688f175aaa5858a661bfeec0f996a15285cd2f0a  cloude-code-toolbox-vscode-1.0.11.vsix

IntelliJ Plugin:
0e9ad9eafefcafbefa18492b20908cbd01f54a309c566d9ee4666be0153cf2e7  cloude-code-toolbox-intellij-0.6.12.zip
```

**Verify:**
```bash
shasum -a 256 packages/claude-code-toolbox/cloude-code-toolbox-vscode-1.0.11.vsix
shasum -a 256 packages/claude-code-toolbox-intellij/build/distributions/cloude-code-toolbox-intellij-0.6.12.zip
```

---

**Built on:** April 17, 2026 at 14:02 (Final Build)  
**Build System:** macOS 24.6.0 (Darwin)  
**Node:** >=20.0.0  
**Gradle:** 9.4.1  
**Kotlin:** 2.1.21  
**IntelliJ Platform:** 2024.3

Both packages are ready for publication and distribution.
