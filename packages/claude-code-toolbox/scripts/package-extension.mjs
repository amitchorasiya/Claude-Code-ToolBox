/**
 * Stages the monorepo root README as packages/cloude-code-toolbox/README.md for vsce
 * (screenshots + relative links → github.com / raw.githubusercontent.com), runs vsce package,
 * then restores the extension README from a stash file.
 *
 * Same pattern as Github-Copilot-ToolBox: Marketplace README uses absolute raw GitHub URLs for
 * screenshots so images resolve from `main` (monorepo-safe). The monorepo root README keeps those
 * absolute URLs so GitHub/npm always render images; this script appends `?v=` for the `.vsix`.
 * GitHub Pages `docs/index.html` uses same-origin `docs/screenshots/` paths.
 *
 * Bridge CLIs are `file:../…` symlinks during dev; `vsce` runs `npm list --production`, which
 * fails for symlinked packages’ nested deps. We temporarily repoint `package.json` to `npm pack`
 * tarballs under `.vsix-bridge-tgz/`, run `npm install`, then `vsce package`, then restore.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = path.join(__dirname, "..");
const MONOREPO_ROOT = path.join(EXT_ROOT, "..", "..");
const PACKAGES_DIR = path.join(EXT_ROOT, "..");
const STASH = path.join(__dirname, ".README.extension.md.stash");
const TGZ_DIR = path.join(EXT_ROOT, ".vsix-bridge-tgz");

const BRIDGE_FOLDERS = [
  "cursor-rules-to-claude",
  "claude-code-memory-bank",
  "cursor-mcp-vscode-port",
];

const GITHUB_REPO = "https://github.com/amitchorasiya/Claude-Code-ToolBox";
const RAW_MAIN =
  "https://raw.githubusercontent.com/amitchorasiya/Claude-Code-ToolBox/main";

function transformRootReadmeForMarketplace(text, screenshotCacheVersion) {
  let s = text;
  s = s.replaceAll("](screenshots/", `](${RAW_MAIN}/screenshots/`);
  if (screenshotCacheVersion) {
    const escapedRaw = RAW_MAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `\\]\\(${escapedRaw}/screenshots/([^)]+\\.png)\\)`,
      "g",
    );
    s = s.replace(
      re,
      `](${RAW_MAIN}/screenshots/$1?v=${encodeURIComponent(screenshotCacheVersion)})`,
    );
  }
  s = s.replaceAll("](LICENSE)", `](${GITHUB_REPO}/blob/main/LICENSE)`);
  s = s.replaceAll(
    "](.vscode/launch.json)",
    `](${GITHUB_REPO}/blob/main/.vscode/launch.json)`,
  );
  s = s.replaceAll(
    "](.github/workflows/extension-ci.yml)",
    `](${GITHUB_REPO}/blob/main/.github/workflows/extension-ci.yml)`,
  );
  s = s.replaceAll(
    "](packages/cloude-code-toolbox/README.md#settings)",
    `](${GITHUB_REPO}/blob/main/packages/cloude-code-toolbox/README.md#settings)`,
  );
  s = s.replaceAll(
    "](packages/cloude-code-toolbox/README.md)",
    `](${GITHUB_REPO}/blob/main/packages/cloude-code-toolbox/README.md)`,
  );
  s = s.replaceAll(
    "](packages/cloude-code-toolbox/LICENSE)",
    `](${GITHUB_REPO}/blob/main/packages/cloude-code-toolbox/LICENSE)`,
  );
  s = s.replaceAll(
    "](packages/cloude-code-toolbox/NOTICE)",
    `](${GITHUB_REPO}/blob/main/packages/cloude-code-toolbox/NOTICE)`,
  );
  s = s.replaceAll(
    "](packages/cloude-code-toolbox/)",
    `](${GITHUB_REPO}/tree/main/packages/cloude-code-toolbox/)`,
  );
  s = s.replaceAll(
    "](packages/cursor-mcp-vscode-port/)",
    `](${GITHUB_REPO}/tree/main/packages/cursor-mcp-vscode-port/)`,
  );
  s = s.replaceAll("](memory-bank/)", `](${GITHUB_REPO}/tree/main/memory-bank/)`);
  s = s.replaceAll("](README.md)", `](${GITHUB_REPO}/blob/main/README.md)`);
  s = s.replaceAll("](docs/", `](${GITHUB_REPO}/blob/main/docs/`);
  s = s.replaceAll("](diagrams/", `](${GITHUB_REPO}/blob/main/diagrams/`);
  return s;
}

function packBridgeTarballs(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const folder of BRIDGE_FOLDERS) {
    const src = path.join(PACKAGES_DIR, folder);
    const pj = path.join(src, "package.json");
    if (!fs.existsSync(pj)) {
      throw new Error(`[package-extension] Missing bridge package: ${src}`);
    }
    execSync(`npm pack --pack-destination "${destDir}"`, { cwd: src, stdio: "inherit" });
  }
}

function pickTarballForPackage(destDir, npmName) {
  const files = fs
    .readdirSync(destDir)
    .filter((f) => f.endsWith(".tgz") && f.startsWith(`${npmName}-`));
  if (files.length === 0) {
    throw new Error(`[package-extension] No .tgz for "${npmName}" in ${destDir}`);
  }
  files.sort();
  return path.join(destDir, files[files.length - 1]);
}

/**
 * Rewrites extension dependencies to file:.vsix-bridge-tgz/<name>-<ver>.tgz. Returns original file text.
 */
function switchExtensionDepsToTarballs(tgzDir) {
  const pkgPath = path.join(EXT_ROOT, "package.json");
  const original = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(original);
  if (!pkg.dependencies) {
    throw new Error("[package-extension] package.json has no dependencies");
  }
  for (const folder of BRIDGE_FOLDERS) {
    const meta = JSON.parse(
      fs.readFileSync(path.join(PACKAGES_DIR, folder, "package.json"), "utf8"),
    );
    const name = meta.name;
    const abs = pickTarballForPackage(tgzDir, name);
    const rel = path.relative(EXT_ROOT, abs).split(path.sep).join("/");
    pkg.dependencies[name] = `file:${rel}`;
  }
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return original;
}

const extensionReadme = path.join(EXT_ROOT, "README.md");
const rootReadme = path.join(MONOREPO_ROOT, "README.md");

if (!fs.existsSync(rootReadme)) {
  console.error("Missing monorepo README:", rootReadme);
  process.exit(1);
}

fs.copyFileSync(extensionReadme, STASH);
let exitCode = 0;
let pkgJsonOriginal = null;
try {
  const { version } = JSON.parse(
    fs.readFileSync(path.join(EXT_ROOT, "package.json"), "utf8"),
  );
  const body = transformRootReadmeForMarketplace(
    fs.readFileSync(rootReadme, "utf8"),
    version,
  );
  fs.writeFileSync(extensionReadme, body, "utf8");
  execSync(
    "npx --yes @resvg/resvg-js-cli resources/icon-marketplace.svg resources/marketplace-icon.png --fit-width 128 --fit-height 128",
    { cwd: EXT_ROOT, stdio: "inherit" },
  );

  fs.rmSync(TGZ_DIR, { recursive: true, force: true });
  packBridgeTarballs(TGZ_DIR);
  pkgJsonOriginal = switchExtensionDepsToTarballs(TGZ_DIR);
  execSync("npm install --no-audit --no-fund", { cwd: EXT_ROOT, stdio: "inherit" });
  execSync("npx vsce package", { cwd: EXT_ROOT, stdio: "inherit" });
} catch (e) {
  console.error(e);
  exitCode = typeof e?.status === "number" ? e.status : 1;
} finally {
  if (pkgJsonOriginal !== null) {
    try {
      fs.writeFileSync(path.join(EXT_ROOT, "package.json"), pkgJsonOriginal);
      execSync("npm install --no-audit --no-fund", { cwd: EXT_ROOT, stdio: "inherit" });
    } catch (re) {
      console.error("[package-extension] Failed to restore package.json / npm install:", re);
    }
  }
  fs.rmSync(TGZ_DIR, { recursive: true, force: true });
  if (fs.existsSync(STASH)) {
    fs.copyFileSync(STASH, extensionReadme);
    fs.unlinkSync(STASH);
  }
}

process.exit(exitCode);
