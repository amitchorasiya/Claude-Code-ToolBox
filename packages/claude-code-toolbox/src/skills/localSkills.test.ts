import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { collectLocalSkills, WORKSPACE_SKILL_ROOT_SEGMENTS } from "./localSkills";

describe("collectLocalSkills", () => {
  it("finds workspace skill under .github/skills and user skill under ~/.copilot/skills layout", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gct-skills-"));
    const home = path.join(tmp, "home");
    const ws = path.join(tmp, "ws");
    await fs.mkdir(path.join(home, ".copilot", "skills", "u1"), { recursive: true });
    await fs.writeFile(path.join(home, ".copilot", "skills", "u1", "SKILL.md"), "---\n---\nUser skill.\n", "utf8");
    const gh = WORKSPACE_SKILL_ROOT_SEGMENTS[0];
    await fs.mkdir(path.join(ws, ...gh, "w1"), { recursive: true });
    await fs.writeFile(path.join(ws, ...gh, "w1", "SKILL.md"), "---\n---\nWs skill.\n", "utf8");

    const skills = await collectLocalSkills(home, ws);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["u1", "w1"]);
    const wsSkill = skills.find((s) => s.name === "w1");
    expect(wsSkill?.scope).toBe("workspace");
    const usSkill = skills.find((s) => s.name === "u1");
    expect(usSkill?.scope).toBe("user");
  });
});
