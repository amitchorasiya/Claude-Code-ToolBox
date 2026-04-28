import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createAgent, deleteAgent, renderAgentMarkdown, updateAgent } from "./agentsMutations";
import { collectLocalAgents } from "./localAgents";

describe("renderAgentMarkdown", () => {
  it("round-trips through the frontmatter parser", async () => {
    const md = renderAgentMarkdown({
      name: "backend-dev",
      description: "Server-side code",
      role: "code",
      model: "claude-opus-4-7",
      tools: ["Read", "Edit"],
      color: "#4ec9b0",
      systemPrompt: "You are a backend engineer.",
      scope: "user",
    });
    expect(md).toContain("name: backend-dev");
    expect(md).toContain("tools: [Read, Edit]");
    expect(md.trim().endsWith("You are a backend engineer.")).toBe(true);
  });
});

describe("agents CRUD", () => {
  it("creates, reads back, updates (rename), and deletes an agent", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-mut-"));
    const home = path.join(tmp, "home");
    await fs.mkdir(path.join(home, ".claude", "agents"), { recursive: true });

    const created = await createAgent(
      {
        name: "backend-dev",
        description: "Server-side",
        role: "code",
        model: "claude-opus-4-7",
        tools: ["Read", "Edit"],
        systemPrompt: "Backend engineer.",
        scope: "user",
      },
      home
    );
    expect(created.filePath).toContain("backend-dev.md");

    let list = await collectLocalAgents(home);
    expect(list.map((a) => a.name)).toContain("backend-dev");

    const renamed = await updateAgent(
      created,
      {
        name: "backend-eng",
        description: "Senior backend",
        role: "code",
        model: "claude-opus-4-7",
        tools: ["Read", "Edit", "Bash"],
        systemPrompt: "Backend engineer (v2).",
        scope: "user",
      },
      home
    );
    expect(renamed.filePath).toContain("backend-eng.md");
    list = await collectLocalAgents(home);
    expect(list.map((a) => a.name)).toContain("backend-eng");
    expect(list.map((a) => a.name)).not.toContain("backend-dev");

    await deleteAgent(renamed);
    list = await collectLocalAgents(home);
    expect(list.map((a) => a.name)).not.toContain("backend-eng");
  });
});
