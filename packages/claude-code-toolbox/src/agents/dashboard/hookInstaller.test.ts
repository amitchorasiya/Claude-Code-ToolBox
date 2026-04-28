import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCommand,
  DEFAULT_HOOK_EVENTS,
  HOOK_SCRIPT_MARKER,
  detectForeignHooks,
  hookStatus,
  installHook,
  renderHookScript,
  rewritePortInScript,
  uninstallHook,
} from "./hookInstaller";

async function mkHome(): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "ct-hook-"));
  await fs.mkdir(path.join(home, ".claude"), { recursive: true });
  return home;
}

describe("hookInstaller", () => {
  it("renders a script that embeds the port number and marker", () => {
    const script = renderHookScript(3456);
    expect(script).toContain(HOOK_SCRIPT_MARKER);
    expect(script).toContain("PORT = 3456");
  });

  it("installs idempotently and uninstalls only our entries", async () => {
    const home = await mkHome();
    const settingsPath = path.join(home, ".claude", "settings.json");
    /* Seed an unrelated user hook entry. */
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "echo user" }] }] },
      }),
      "utf8"
    );

    const res = await installHook({ homeDir: home, port: 3456 });
    expect(res.eventsInstalled).toEqual(DEFAULT_HOOK_EVENTS);

    const after = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const pre = after.hooks.PreToolUse as Array<{ hooks: Array<{ command: string }> }>;
    expect(pre.length).toBe(2);
    expect(pre.some((e) => e.hooks.some((h) => h.command === "echo user"))).toBe(true);

    /* Re-install is a no-op. */
    await installHook({ homeDir: home, port: 3456 });
    const second = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    expect(second.hooks.PreToolUse.length).toBe(2);

    /* Uninstall removes only ours. */
    const u = await uninstallHook(home);
    expect(u.removedEvents.sort()).toEqual([...DEFAULT_HOOK_EVENTS].sort());
    const final = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    expect(final.hooks.PreToolUse.length).toBe(1);
    expect(final.hooks.PreToolUse[0].hooks[0].command).toBe("echo user");
  });

  it("reports status accurately", async () => {
    const home = await mkHome();
    await installHook({ homeDir: home, port: 4567 });
    const st = await hookStatus(home);
    expect(st.installed).toBe(true);
    expect(st.port).toBe(4567);
    expect(st.events.sort()).toEqual([...DEFAULT_HOOK_EVENTS].sort());
  });

  it("rewritePortInScript updates the helper without touching settings", async () => {
    const home = await mkHome();
    await installHook({ homeDir: home, port: 3456 });
    await rewritePortInScript(9999, home);
    const st = await hookStatus(home);
    expect(st.port).toBe(9999);
  });

  it("refuses to edit malformed settings.json", async () => {
    const home = await mkHome();
    await fs.writeFile(path.join(home, ".claude", "settings.json"), "{ broken", "utf8");
    await expect(installHook({ homeDir: home, port: 3456 })).rejects.toThrow(/not valid JSON/);
  });

  it("buildCommand uses platform-specific python binary", () => {
    const cmd = buildCommand("/tmp/foo.py");
    expect(cmd).toContain("/tmp/foo.py");
    expect(cmd.split(" ")[0]).toMatch(/python3?/);
  });

  it("detectForeignHooks surfaces agent-dock-like entries outside our script path", async () => {
    const home = await mkHome();
    const settingsPath = path.join(home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: "command", command: "python3 /opt/agent-dock/hook.py" }] },
            { hooks: [{ type: "command", command: "echo unrelated" }] },
          ],
        },
      }),
      "utf8"
    );
    await installHook({ homeDir: home, port: 3456 });
    const foreign = await detectForeignHooks(home);
    expect(foreign.length).toBe(1);
    expect(foreign[0]).toContain("agent-dock");
  });

  it("detectForeignHooks ignores our own script paths", async () => {
    const home = await mkHome();
    await installHook({ homeDir: home, port: 3456 });
    const foreign = await detectForeignHooks(home);
    expect(foreign).toEqual([]);
  });
});
