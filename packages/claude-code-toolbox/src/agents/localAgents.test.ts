import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectLocalAgents,
  colorForAgentName,
  parseAgentFrontmatter,
} from "./localAgents";

const SAMPLE_AGENT = [
  "---",
  "name: backend-dev",
  "description: Implements server-side code and APIs",
  "role: code",
  "model: claude-opus-4-7",
  "tools: [Read, Edit, Write, Bash]",
  "color: \"#4ec9b0\"",
  "---",
  "",
  "You are a senior backend engineer.",
  "",
].join("\n");

describe("parseAgentFrontmatter", () => {
  it("parses scalar fields and inline arrays", () => {
    const fm = SAMPLE_AGENT.split("---")[1];
    const parsed = parseAgentFrontmatter(fm.trim());
    expect(parsed.name).toBe("backend-dev");
    expect(parsed.description).toBe("Implements server-side code and APIs");
    expect(parsed.role).toBe("code");
    expect(parsed.model).toBe("claude-opus-4-7");
    expect(parsed.color).toBe("#4ec9b0");
    expect(parsed.tools).toEqual(["Read", "Edit", "Write", "Bash"]);
  });

  it("returns empty map for empty frontmatter", () => {
    expect(parseAgentFrontmatter("")).toEqual({});
  });
});

describe("colorForAgentName", () => {
  it("returns a deterministic hex color for a given name", () => {
    const a = colorForAgentName("backend-dev");
    const b = colorForAgentName("backend-dev");
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9a-fA-F]+$/);
  });
});

describe("collectLocalAgents", () => {
  it("discovers user + workspace .md agents and prefers workspace on duplicate paths", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-agents-"));
    const home = path.join(tmp, "home");
    const ws = path.join(tmp, "ws");
    await fs.mkdir(path.join(home, ".claude", "agents"), { recursive: true });
    await fs.mkdir(path.join(ws, ".claude", "agents"), { recursive: true });
    await fs.writeFile(path.join(home, ".claude", "agents", "backend-dev.md"), SAMPLE_AGENT, "utf8");
    await fs.writeFile(
      path.join(ws, ".claude", "agents", "reviewer.md"),
      [
        "---",
        "name: reviewer",
        "description: Reviews diffs",
        "role: review",
        "tools: [Read, Grep]",
        "---",
        "",
        "Review diffs.",
        "",
      ].join("\n"),
      "utf8"
    );

    const list = await collectLocalAgents(home, ws);
    const names = list.map((a) => a.name).sort();
    expect(names).toEqual(["backend-dev", "reviewer"]);
    const be = list.find((a) => a.name === "backend-dev");
    expect(be?.scope).toBe("user");
    expect(be?.tools).toContain("Edit");
    expect(be?.color).toBe("#4ec9b0");
    const rv = list.find((a) => a.name === "reviewer");
    expect(rv?.scope).toBe("workspace");
    expect(rv?.role).toBe("review");
  });

  it("returns empty list when no agents directory exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-agents-empty-"));
    const list = await collectLocalAgents(tmp);
    expect(list).toEqual([]);
  });
});
