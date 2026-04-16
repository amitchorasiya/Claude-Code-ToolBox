import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  agentsSkillsDir,
  cursorSkillsDir,
  githubSkillsDir,
  listSkillFoldersAtRoot,
  migrateOneSkillFolder,
  runCopilotGithubSkillsMigrationForRoot,
} from "./migrateCursorSkillsToAgents";

describe("migrateCursorSkillsToAgents", () => {
  it("lists and copies skill folder to .agents/skills", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gct-mig-"));
    const cur = cursorSkillsDir(tmp);
    const ag = agentsSkillsDir(tmp);
    await fs.mkdir(path.join(cur, "my-skill"), { recursive: true });
    await fs.writeFile(path.join(cur, "my-skill", "SKILL.md"), "# x\n", "utf8");

    const listed = await listSkillFoldersAtRoot(cur);
    expect(listed.map((x) => x.name)).toEqual(["my-skill"]);

    const r = await migrateOneSkillFolder(listed[0].abs, ag, listed[0].name, "copy");
    expect(r).toBe("migrated");
    await fs.access(path.join(ag, "my-skill", "SKILL.md"));
    await fs.access(path.join(cur, "my-skill", "SKILL.md"));

    const r2 = await migrateOneSkillFolder(listed[0].abs, ag, listed[0].name, "copy");
    expect(r2).toBe("skipped");
  });

  it("merges missing files when destination skill folder already exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gct-mig3-"));
    const cur = cursorSkillsDir(tmp);
    const ag = agentsSkillsDir(tmp);
    await fs.mkdir(path.join(cur, "dup"), { recursive: true });
    await fs.writeFile(path.join(cur, "dup", "SKILL.md"), "# src\n", "utf8");
    await fs.writeFile(path.join(cur, "dup", "extra.md"), "x\n", "utf8");
    await fs.mkdir(path.join(ag, "dup"), { recursive: true });
    await fs.writeFile(path.join(ag, "dup", "SKILL.md"), "# dest\n", "utf8");
    const listed = await listSkillFoldersAtRoot(cur);
    const r = await migrateOneSkillFolder(listed[0].abs, ag, listed[0].name, "copy");
    expect(r).toBe("migrated");
    expect(await fs.readFile(path.join(ag, "dup", "SKILL.md"), "utf8")).toContain("# dest");
    expect(await fs.readFile(path.join(ag, "dup", "extra.md"), "utf8")).toBe("x\n");
  });

  it("move removes source", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gct-mig2-"));
    const cur = cursorSkillsDir(tmp);
    const ag = agentsSkillsDir(tmp);
    await fs.mkdir(path.join(cur, "mv"), { recursive: true });
    await fs.writeFile(path.join(cur, "mv", "SKILL.md"), "# y\n", "utf8");
    const listed = await listSkillFoldersAtRoot(cur);
    const r = await migrateOneSkillFolder(listed[0].abs, ag, listed[0].name, "move");
    expect(r).toBe("migrated");
    await fs.access(path.join(ag, "mv", "SKILL.md"));
    await expect(fs.access(path.join(cur, "mv"))).rejects.toThrow();
  });

  it("migrates .github/skills to .agents/skills", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gct-ghsk-"));
    const gh = githubSkillsDir(tmp);
    const ag = agentsSkillsDir(tmp);
    await fs.mkdir(path.join(gh, "gh-skill"), { recursive: true });
    await fs.writeFile(path.join(gh, "gh-skill", "SKILL.md"), "# gh\n", "utf8");
    const run = await runCopilotGithubSkillsMigrationForRoot(tmp, "copy");
    expect(run.migrated).toBe(1);
    await fs.access(path.join(ag, "gh-skill", "SKILL.md"));
    await fs.access(path.join(gh, "gh-skill", "SKILL.md"));
  });
});
