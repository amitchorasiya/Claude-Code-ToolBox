/**
 * claude-code-memory-bank — scaffold memory bank + CLAUDE.md context block
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const TEMPLATES = join(PKG_ROOT, "templates");

const MARKER_BEGIN = "<!-- claude-code-memory-bank:begin -->";
const MARKER_END = "<!-- claude-code-memory-bank:end -->";

const CURSOR_RULE_FILES = ["memory-bank.mdc", "core.mdc"];

function usage() {
  console.log(`claude-code-memory-bank — scaffold a memory bank for Claude Code / VS Code

Usage:
  npx claude-code-memory-bank init [options]

Options:
  --cwd <dir>              Project root (default: current directory)
  --bank-dir <path>        Memory bank folder relative to cwd (default: memory-bank)
  --dry-run                Print actions without writing files
  --cursor-rules           Also install .cursor/rules/*.mdc (Plan/Act + memory bank rules for Cursor) if missing
  --no-claude-md           Do not create or update CLAUDE.md
  -h, --help               Show help

Legacy flags --force, --claude-md-replace, and --copilot-replace are ignored (merge-only).

Examples:
  npx cloude-code-memory-bank init
  npx cloude-code-memory-bank init --cursor-rules
  npx cloude-code-memory-bank init --bank-dir docs/memory-bank --dry-run
`);
}

function parseArgs(argv) {
  const args = {
    _: [],
    cwd: process.cwd(),
    bankDir: "memory-bank",
    dryRun: false,
    claudeMd: true,
    cursorRules: false,
    legacyReplaceFlagSeen: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") return { help: true };
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (a === "--force" || a === "--claude-md-replace" || a === "--copilot-replace") {
      args.legacyReplaceFlagSeen = true;
      continue;
    }
    if (a === "--cursor-rules") {
      args.cursorRules = true;
      continue;
    }
    if (a === "--no-claude-md" || a === "--no-copilot") {
      args.claudeMd = false;
      continue;
    }
    if (a === "--cwd") {
      args.cwd = argv[++i] ?? args.cwd;
      continue;
    }
    if (a === "--bank-dir") {
      args.bankDir = argv[++i] ?? args.bankDir;
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    }
    args._.push(a);
  }
  return args;
}

function normalizeBankPath(bankDir) {
  return bankDir.replace(/^[/\\]+/, "").replace(/[/\\]+$/g, "");
}

/** Reject --bank-dir values that try to walk above the workspace via `..`. */
function assertSafeBankDirSegments(bankDirNorm) {
  const parts = bankDirNorm.split(/[/\\]+/).filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error("--bank-dir must not contain parent directory segments (..)");
  }
}

/**
 * Resolve candidate under workspace root or throw (mitigates path traversal via --cwd / --bank-dir).
 * @returns {string} canonical absolute path under root (or root itself)
 */
function resolvePathUnderRoot(root, candidate) {
  const r = resolve(root);
  const t = resolve(candidate);
  if (t === r) return t;
  const rel = relative(r, t);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace (${r}): ${candidate}`);
  }
  return t;
}

function assertPathInsideRoot(root, target) {
  resolvePathUnderRoot(root, target);
}

function safeWriteFileSync(root, dest, data, encoding = "utf8") {
  const out = resolvePathUnderRoot(root, dest);
  const payload =
    typeof data === "string" ? Buffer.from(data, encoding) : Buffer.from(data);
  writeFileSync(pathToFileURL(out), payload);
}

function bankPathForInstructions(root, bankDirNorm) {
  const rel = relative(root, join(root, bankDirNorm));
  const use = rel && !rel.startsWith("..") ? rel : bankDirNorm;
  const posix = use.split(/[/\\]/).join("/");
  return posix.startsWith(".") ? posix : `./${posix}`;
}

function mergeClaudeMd(existing, block) {
  const text = existing;
  if (!text.includes(MARKER_BEGIN)) {
    const sep = text.trimEnd().length ? "\n\n" : "";
    return `${text.trimEnd()}${sep}${block}\n`;
  }
  const re = new RegExp(`${escapeRe(MARKER_BEGIN)}[\\s\\S]*?${escapeRe(MARKER_END)}`, "m");
  return text.replace(re, block.trimEnd());
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function installCursorRules({ root, bankDisplay, dryRun }) {
  const destDir = join(root, ".cursor", "rules");
  const srcDir = join(TEMPLATES, "cursor-rules");

  if (!existsSync(srcDir)) {
    console.error(`Missing templates: ${srcDir}`);
    process.exit(1);
  }

  const available = new Set(readdirSync(srcDir));
  for (const name of CURSOR_RULE_FILES) {
    if (!available.has(name)) {
      console.error(`Missing Cursor rule template: ${join(srcDir, name)}`);
      process.exit(1);
    }
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    if (existsSync(dest)) {
      console.log(`skip (exists): ${dest}`);
      continue;
    }
    let body = readFileSync(src, "utf8");
    body = body.replaceAll("{{BANK_PATH}}", bankDisplay);
    if (dryRun) {
      console.log(`[dry-run] write ${dest}`);
      continue;
    }
    mkdirSync(destDir, { recursive: true });
    safeWriteFileSync(root, dest, body, "utf8");
    console.log(`wrote ${dest}`);
  }
}

function applyClaudeMd({ root, bankDisplay, dryRun }) {
  const claudePath = join(root, "CLAUDE.md");
  const tplPath = join(TEMPLATES, "claude-snippet.md");
  let tpl = readFileSync(tplPath, "utf8");
  tpl = tpl.replaceAll("{{BANK_PATH}}", bankDisplay);

  const block = `${MARKER_BEGIN}
${tpl.trim()}
${MARKER_END}`;

  if (dryRun) {
    console.log(`[dry-run] merge block into ${claudePath}`);
    return;
  }

  if (!existsSync(claudePath)) {
    safeWriteFileSync(root, claudePath, `${block}\n`, "utf8");
    console.log(`wrote ${claudePath}`);
    return;
  }

  const existing = readFileSync(claudePath, "utf8");
  const merged = mergeClaudeMd(existing, block);
  safeWriteFileSync(root, claudePath, merged, "utf8");
  console.log(`merged memory-bank section into ${claudePath}`);
}

/** @param {string[]} argv - args after the script name (e.g. process.argv.slice(2)) */
export function run(argv) {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    usage();
    process.exit(0);
  }
  if (argv[0] !== "init") {
    console.error("Unknown command. Use: cloude-code-memory-bank init\nRun with --help for options.");
    process.exit(1);
  }

  const parsed = parseArgs(argv.slice(1));
  if (parsed.help) {
    usage();
    process.exit(0);
  }

  if (parsed.legacyReplaceFlagSeen) {
    console.error(
      "[cloude-code-memory-bank] Legacy replace/force flag detected; ignored. Merge-only policy is always enforced."
    );
  }

  const root = resolve(parsed.cwd);
  const bankDirNorm = normalizeBankPath(parsed.bankDir);
  assertSafeBankDirSegments(bankDirNorm);
  const bankRoot = join(root, bankDirNorm);
  assertPathInsideRoot(root, bankRoot);
  const bankDisplay = bankPathForInstructions(root, bankDirNorm);

  const bankFiles = [
    "projectbrief.md",
    "productContext.md",
    "activeContext.md",
    "systemPatterns.md",
    "techContext.md",
    "progress.md",
  ];

  for (const name of bankFiles) {
    const dest = join(bankRoot, name);
    const src = join(TEMPLATES, "memory-bank", name);
    if (!existsSync(src)) {
      console.error(`Missing template: ${src}`);
      process.exit(1);
    }
    if (existsSync(dest)) {
      console.log(`skip (exists): ${dest}`);
      continue;
    }
    let body = readFileSync(src, "utf8");
    body = body.replaceAll("{{BANK_PATH}}", bankDisplay);
    if (parsed.dryRun) {
      console.log(`[dry-run] copy template -> ${dest}`);
      continue;
    }
    mkdirSync(bankRoot, { recursive: true });
    safeWriteFileSync(root, dest, body, "utf8");
    console.log(`wrote ${dest}`);
  }

  if (parsed.claudeMd) {
    applyClaudeMd({
      root,
      bankDisplay,
      dryRun: parsed.dryRun,
    });
  }

  if (parsed.cursorRules) {
    installCursorRules({
      root,
      bankDisplay,
      dryRun: parsed.dryRun,
    });
  }
}
