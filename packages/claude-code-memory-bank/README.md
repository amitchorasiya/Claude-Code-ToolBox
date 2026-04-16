# cloude-code-memory-bank

Scaffolds a **Cursor-style memory bank** (Markdown under `memory-bank/`) and merges a bounded block into **`CLAUDE.md`** so **Claude Code** and humans share the same project context. Optionally installs **`.cursor/rules/*.mdc`** for teams that also use Cursor.

**Monorepo:** [Claude-Code-ToolBox](https://github.com/amitchorasiya/Claude-Code-ToolBox) — **Claude Code ToolBox** ships as a [VS Code extension](https://marketplace.visualstudio.com/items?itemName=amitchorasiya.claude-code-toolbox-vscode) and a [JetBrains plugin](https://plugins.jetbrains.com/search?search=Cloude+Code+ToolBox) ([`jetbrains://…`](jetbrains://Plugins?action=install&pluginId=com.amitchorasiya.cloude.code.toolbox)); both can run this CLI via **`npx`** or the **bundled** `node …/cli.mjs` path (One Click / Intelligence flows).

There is **no hidden server memory**: the bank is **plain Markdown in your repo** that you maintain and commit.

---

## Requirements

- **Node.js 18+**

---

## Usage

```bash
npx cloude-code-memory-bank init [options]
```

```bash
node bin/cli.mjs init [options]   # from a clone of this package
```

Run **`init --help`** for the same summary as below.

---

## Command: `init`

| Option | Description |
|--------|-------------|
| `--cwd <dir>` | Project root (default: current working directory). |
| `--bank-dir <path>` | Folder for memory files, **relative to `--cwd`**. Default: `memory-bank`. Must not contain `..` segments. |
| `--dry-run` | Print actions; do **not** write files. |
| `--cursor-rules` | Install **`.cursor/rules/memory-bank.mdc`** and **`.cursor/rules/core.mdc`** only if missing. |
| `--no-claude-md` | Skip **`CLAUDE.md`** (aliases: **`--no-copilot`** — legacy name only). |
| `-h`, `--help` | Show help. |

**Merge-only:** existing **`memory-bank/*.md`** files are never overwritten. **`CLAUDE.md`** is updated only via the bounded HTML-comment block. **`--force`**, **`--claude-md-replace`**, and **`--copilot-replace`** are ignored if passed.

**Examples**

```bash
npx cloude-code-memory-bank init
npx cloude-code-memory-bank init --cursor-rules
npx cloude-code-memory-bank init --bank-dir docs/memory-bank --dry-run
npx cloude-code-memory-bank init --no-claude-md    # memory bank + optional Cursor rules only
```

---

## Files created

**Default layout** (`init` with **`CLAUDE.md`** merge):

```text
your-repo/
├── CLAUDE.md                      # created or merged (bounded block)
└── memory-bank/
    ├── projectbrief.md
    ├── productContext.md
    ├── activeContext.md
    ├── systemPatterns.md
    ├── techContext.md
    └── progress.md
```

**`CLAUDE.md` merge:** a block wrapped in:

```html
<!-- cloude-code-memory-bank:begin -->
…
<!-- cloude-code-memory-bank:end -->
```

Re-running **`init`** replaces **only** that block when the markers exist; other content in **`CLAUDE.md`** is preserved unless you pass **`--claude-md-replace`**.

**With `--cursor-rules`:** also creates **`.cursor/rules/memory-bank.mdc`** and **`.cursor/rules/core.mdc`** (skipped if present unless **`--force`**).

---

## Developing this package

From **`packages/cloude-code-memory-bank/`**:

```bash
node bin/cli.mjs init --dry-run --cwd /path/to/test/repo
```

See **`NOTICE`** and **`LICENSE`** in this directory.

---

## License

MIT — see **`LICENSE`**.
