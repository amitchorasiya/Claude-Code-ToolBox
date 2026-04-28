import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SDLC_STARTER_PACK,
  installSdlcStarterPack,
  starterPackDefaultSelection,
  writePresetTeamsIfEligible,
} from "./starterPack";
import { collectLocalAgents } from "./localAgents";

describe("SDLC starter pack", () => {
  it("ships 9 agents with unique ids and valid hex colors", () => {
    expect(SDLC_STARTER_PACK.length).toBe(9);
    const ids = new Set(SDLC_STARTER_PACK.map((a) => a.id));
    expect(ids.size).toBe(9);
    for (const a of SDLC_STARTER_PACK) {
      expect(a.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(a.systemPrompt.trim().length).toBeGreaterThan(20);
    }
  });

  it("default selection is non-empty", () => {
    expect(starterPackDefaultSelection().length).toBeGreaterThan(0);
  });

  it("installs only the selected agents into ~/.claude/agents and skips duplicates", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-pack-"));
    const home = path.join(tmp, "home");

    const first = await installSdlcStarterPack({
      selected: ["product-manager", "architect"],
      scope: "user",
      homeDir: home,
    });
    expect(first.written.sort()).toEqual(["architect", "product-manager"]);
    expect(first.skipped).toEqual([]);

    const list = await collectLocalAgents(home);
    expect(list.map((a) => a.name).sort()).toEqual(["architect", "product-manager"]);

    const second = await installSdlcStarterPack({
      selected: ["product-manager", "architect"],
      scope: "user",
      homeDir: home,
    });
    expect(second.written).toEqual([]);
    expect(second.skipped.sort()).toEqual(["architect", "product-manager"]);
  });

  it("writes preset team JSON when all required agents are installed", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-pack-teams-"));
    const home = path.join(tmp, "home");
    const res = await installSdlcStarterPack({
      selected: ["product-manager", "architect", "security-reviewer"],
      scope: "user",
      homeDir: home,
    });
    expect(res.teamsWritten.length).toBeGreaterThan(0);
    const debatePath = path.join(home, ".claude", "teams", "sdlc-debate.json");
    const content = JSON.parse(await fs.readFile(debatePath, "utf8"));
    expect(content.name).toBe("sdlc-debate");
    expect(content.protocol).toBe("debate");
    expect(content.agents).toContain("architect");
    expect(content.judge).toBe("architect");
  });

  it("skips preset teams whose required agents are missing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-pack-partial-"));
    const home = path.join(tmp, "home");
    /* Install only one of the three required agents for sdlc-debate. */
    const res = await installSdlcStarterPack({
      selected: ["architect"],
      scope: "user",
      homeDir: home,
    });
    expect(res.teamsWritten).toEqual([]);
    /* teams dir may still be created but should not contain the debate file. */
    const debatePath = path.join(home, ".claude", "teams", "sdlc-debate.json");
    let present = false;
    try {
      await fs.access(debatePath);
      present = true;
    } catch {
      present = false;
    }
    expect(present).toBe(false);
  });

  it("writePresetTeamsIfEligible can be called standalone (no starter-pack install)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-write-teams-"));
    const home = path.join(tmp, "home");
    /* Pre-seed agents as if starter-pack was installed earlier. */
    const agentsDir = path.join(home, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    for (const id of ["product-manager", "architect", "security-reviewer"]) {
      await fs.writeFile(
        path.join(agentsDir, `${id}.md`),
        `---\nname: ${id}\ndescription: test\nrole: plan\ntools: []\n---\n`,
        "utf8"
      );
    }
    const paths = await writePresetTeamsIfEligible({
      scope: "user",
      homeDir: home,
    });
    expect(paths.length).toBeGreaterThanOrEqual(1);
    const names = paths.map((p) => path.basename(p));
    expect(names).toContain("sdlc-debate.json");
  });

  it("writePresetTeamsIfEligible is idempotent (does not overwrite existing team file)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-write-teams-idem-"));
    const home = path.join(tmp, "home");
    const agentsDir = path.join(home, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    for (const id of ["product-manager", "architect", "security-reviewer"]) {
      await fs.writeFile(
        path.join(agentsDir, `${id}.md`),
        `---\nname: ${id}\ndescription: test\nrole: plan\ntools: []\n---\n`,
        "utf8"
      );
    }
    const first = await writePresetTeamsIfEligible({ scope: "user", homeDir: home });
    const second = await writePresetTeamsIfEligible({ scope: "user", homeDir: home });
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });

  it("writePresetTeamsIfEligible returns [] when no eligible agents exist", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-write-teams-empty-"));
    const home = path.join(tmp, "home");
    const res = await writePresetTeamsIfEligible({ scope: "user", homeDir: home });
    expect(res).toEqual([]);
  });
});
