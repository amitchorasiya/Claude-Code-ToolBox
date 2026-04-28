import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectLocalTeams,
  createTeam,
  deleteTeam,
  runtimeForProtocol,
  updateTeam,
} from "./teamsStore";

describe("runtimeForProtocol", () => {
  it("maps protocols to native or custom runtime", () => {
    expect(runtimeForProtocol("native-task")).toBe("native");
    expect(runtimeForProtocol("round-robin")).toBe("native");
    expect(runtimeForProtocol("handoff")).toBe("native");
    expect(runtimeForProtocol("plan-then-code")).toBe("custom");
    expect(runtimeForProtocol("debate")).toBe("custom");
    expect(runtimeForProtocol("orchestrator")).toBe("custom");
    expect(runtimeForProtocol("parallel-fan-out")).toBe("custom");
  });
});

describe("teams CRUD", () => {
  it("creates, reads back, updates, and deletes a team", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "at-teams-"));
    const home = path.join(tmp, "home");

    const created = await createTeam(
      {
        name: "sdlc-core",
        description: "End-to-end feature team",
        protocol: "plan-then-code",
        runtime: "custom",
        maxTurns: 25,
        agents: ["product-manager", "architect"],
        codePhaseAgents: ["backend-dev", "frontend-dev"],
        judge: "architect",
        scope: "user",
      },
      home
    );
    expect(created.filePath).toContain("sdlc-core.json");

    let list = await collectLocalTeams(home);
    expect(list.map((t) => t.name)).toContain("sdlc-core");

    const updated = await updateTeam(
      created,
      {
        name: "sdlc-core",
        description: "End-to-end feature team (v2)",
        protocol: "debate",
        runtime: "custom",
        maxTurns: 10,
        agents: ["architect", "security-reviewer"],
        codePhaseAgents: [],
        judge: "architect",
        scope: "user",
      },
      home
    );
    expect(updated.protocol).toBe("debate");
    expect(updated.maxTurns).toBe(10);
    expect(updated.agents).toEqual(["architect", "security-reviewer"]);

    await deleteTeam(updated);
    list = await collectLocalTeams(home);
    expect(list.map((t) => t.name)).not.toContain("sdlc-core");
  });
});
