import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMANDS_PACK_MARKER,
  SDLC_COMMANDS,
  commandsDirForScope,
  commandsPackDefaultSelection,
  installCommandsPack,
  listInstalledCommands,
  uninstallCommandsPack,
} from "./commandsPack";

async function mkHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ct-cmds-"));
}

describe("SDLC_COMMANDS", () => {
  it("ships 6 commands with valid, non-reserved names", () => {
    const reserved = new Set(["plan", "compact", "help", "loop", "clear"]);
    expect(SDLC_COMMANDS.length).toBe(6);
    const ids = new Set<string>();
    for (const c of SDLC_COMMANDS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
      expect(reserved.has(c.id)).toBe(false);
      expect(c.description.length).toBeGreaterThan(10);
      expect(c.body.includes("$ARGUMENTS") || c.body.length > 0).toBe(true);
      ids.add(c.id);
    }
    expect(ids.size).toBe(6);
  });

  it("default selection is non-empty", () => {
    expect(commandsPackDefaultSelection().length).toBeGreaterThan(0);
  });
});

describe("commandsDirForScope", () => {
  it("returns ~/.claude/commands for user scope", () => {
    const p = commandsDirForScope("user", "/home/me");
    expect(p).toBe(path.join("/home/me", ".claude", "commands"));
  });
  it("returns undefined for workspace scope with no workspaceRoot", () => {
    expect(commandsDirForScope("workspace", "/home/me")).toBeUndefined();
  });
  it("returns <workspaceRoot>/.claude/commands for workspace scope", () => {
    const p = commandsDirForScope("workspace", "/home/me", "/ws/project");
    expect(p).toBe(path.join("/ws/project", ".claude", "commands"));
  });
});

describe("installCommandsPack", () => {
  it("writes selected commands with marker + frontmatter", async () => {
    const home = await mkHome();
    const res = await installCommandsPack({
      selected: ["plan-team", "debate-team"],
      scope: "user",
      homeDir: home,
    });
    expect(res.written.sort()).toEqual(["debate-team", "plan-team"]);
    expect(res.skipped).toEqual([]);

    const debatePath = path.join(home, ".claude", "commands", "debate-team.md");
    const text = await fs.readFile(debatePath, "utf8");
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain(COMMANDS_PACK_MARKER);
    expect(text).toContain("description:");
    expect(text).toContain("$ARGUMENTS");
  });

  it("skips existing Toolbox files when overwrite is false", async () => {
    const home = await mkHome();
    await installCommandsPack({ selected: ["plan-team"], scope: "user", homeDir: home });
    const second = await installCommandsPack({
      selected: ["plan-team"],
      scope: "user",
      homeDir: home,
    });
    expect(second.written).toEqual([]);
    expect(second.skipped).toEqual(["plan-team"]);
  });

  it("never overwrites foreign files (no marker) even with overwrite=true", async () => {
    const home = await mkHome();
    const dir = path.join(home, ".claude", "commands");
    await fs.mkdir(dir, { recursive: true });
    const foreignPath = path.join(dir, "plan-team.md");
    await fs.writeFile(foreignPath, "user's own content\n", "utf8");

    const res = await installCommandsPack({
      selected: ["plan-team"],
      scope: "user",
      homeDir: home,
      overwrite: true,
    });
    expect(res.written).toEqual([]);
    expect(res.skipped).toContain("plan-team");
    const still = await fs.readFile(foreignPath, "utf8");
    expect(still).toBe("user's own content\n");
  });

  it("throws on workspace scope without workspaceRoot", async () => {
    const home = await mkHome();
    await expect(
      installCommandsPack({ selected: ["plan-team"], scope: "workspace", homeDir: home })
    ).rejects.toThrow(/workspace/);
  });
});

describe("uninstallCommandsPack", () => {
  it("removes only Toolbox-owned files", async () => {
    const home = await mkHome();
    await installCommandsPack({
      selected: commandsPackDefaultSelection(),
      scope: "user",
      homeDir: home,
    });
    /* Plant a foreign file. */
    const dir = path.join(home, ".claude", "commands");
    const foreignPath = path.join(dir, "user-owned.md");
    await fs.writeFile(foreignPath, "hello\n", "utf8");

    const res = await uninstallCommandsPack({ scope: "user", homeDir: home });
    expect(res.removed.length).toBeGreaterThan(0);
    expect(res.removed).not.toContain("user-owned");

    const stillThere = await fs.readFile(foreignPath, "utf8");
    expect(stillThere).toBe("hello\n");
  });
});

describe("listInstalledCommands", () => {
  it("reports ownership + description parsed from frontmatter", async () => {
    const home = await mkHome();
    await installCommandsPack({
      selected: ["plan-team"],
      scope: "user",
      homeDir: home,
    });
    /* Add a foreign one to confirm both are listed. */
    const dir = path.join(home, ".claude", "commands");
    await fs.writeFile(
      path.join(dir, "foreign.md"),
      "---\ndescription: custom user thing\n---\nfoo\n",
      "utf8"
    );

    const list = await listInstalledCommands(home);
    const ours = list.find((c) => c.id === "plan-team");
    const foreign = list.find((c) => c.id === "foreign");
    expect(ours?.ownedByToolbox).toBe(true);
    expect(ours?.description).toBeTruthy();
    expect(foreign?.ownedByToolbox).toBe(false);
    expect(foreign?.description).toBe("custom user thing");
  });
});
