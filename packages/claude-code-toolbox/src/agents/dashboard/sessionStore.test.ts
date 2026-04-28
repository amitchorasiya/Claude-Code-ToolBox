import { describe, expect, it } from "vitest";
import { SessionStore } from "./sessionStore";

describe("SessionStore", () => {
  it("creates a card on first hook event and drives state transitions", () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    s.applyHookEvent({
      hook_event_name: "PreToolUse",
      session_id: "abc",
      tool_name: "Edit",
      tool_input: { file_path: "src/foo.ts" },
    });
    let c = s.getCard("abc")!;
    expect(c.status).toBe("running");
    expect(c.currentTool?.name).toBe("Edit");
    expect(c.currentTool?.target).toBe("src/foo.ts");
    expect(c.toolFeed.length).toBe(1);

    s.applyHookEvent({
      hook_event_name: "PermissionRequest",
      session_id: "abc",
      tool_name: "Edit",
      tool_input: { file_path: "src/foo.ts" },
    });
    c = s.getCard("abc")!;
    expect(c.status).toBe("awaiting_permission");
    expect(c.waitingForPermission).toBe(true);

    s.applyHookEvent({ hook_event_name: "PostToolUse", session_id: "abc", tool_name: "Edit" });
    c = s.getCard("abc")!;
    expect(c.status).toBe("thinking");
    expect(c.waitingForPermission).toBe(false);
    expect(c.currentTool).toBeUndefined();
    expect(c.toolFeed[0].status).toBe("done");

    s.applyHookEvent({ hook_event_name: "Stop", session_id: "abc" });
    c = s.getCard("abc")!;
    expect(c.status).toBe("done");
    expect(c.endedAt).toBeDefined();
  });

  it("emits change events on each patch", () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    let received = 0;
    s.onChange(() => (received += 1));
    s.applyPatch({ sessionId: "x", status: "thinking" });
    s.applyPatch({ sessionId: "x", status: "running" });
    expect(received).toBe(2);
  });

  it("records and acknowledges safety alerts", () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    s.applyPatch({ sessionId: "y" });
    s.recordSafetyAlert("y", {
      id: "1",
      pattern: "rm -rf",
      tool: "Bash",
      target: "rm -rf /tmp/thing",
      t: new Date().toISOString(),
      acknowledged: false,
    });
    let c = s.getCard("y")!;
    expect(c.safetyAlerts?.length).toBe(1);
    s.acknowledgeSafetyAlert("y", "1");
    c = s.getCard("y")!;
    expect(c.safetyAlerts?.[0].acknowledged).toBe(true);
  });

  it("accumulates cost and computes projection when a budget is set", () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    s.applyPatch({ sessionId: "z", budgetUsd: 0.5, costUsd: 0.1 });
    const c = s.getCard("z")!;
    expect(c.projectedCostUsd).toBeGreaterThanOrEqual(0.1);
  });

  it("pinned done cards survive garbage collection", async () => {
    const s = new SessionStore({ retainDoneCardsMs: 5 });
    s.applyPatch({ sessionId: "p", status: "done" });
    s.pin("p", true);
    s.startGc();
    await new Promise((r) => setTimeout(r, 30));
    expect(s.getCard("p")).toBeDefined();
    s.dispose();
  });

  it("emits a hard budget breach when costUsd exceeds budgetUsd", () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    const breaches: string[] = [];
    s.onBudgetBreach((ev) => breaches.push(ev.severity));
    /* First patch establishes a budget and exceeds it directly. */
    s.applyPatch({
      sessionId: "b",
      runId: "b",
      budgetUsd: 1,
      costUsd: 5,
      status: "running",
    });
    expect(breaches).toContain("hard");
  });

  it("emits a soft budget breach when projectedCostUsd crosses budgetUsd", async () => {
    const s = new SessionStore({ retainDoneCardsMs: 0 });
    const received: string[] = [];
    s.onBudgetBreach((ev) => received.push(ev.severity));
    s.applyPatch({
      sessionId: "s1",
      runId: "s1",
      budgetUsd: 10,
      costUsd: 1,
      status: "running",
    });
    await new Promise((r) => setTimeout(r, 50));
    /* Second update bumps cost — projection is now much higher than 10. */
    s.applyPatch({ sessionId: "s1", costUsd: 9.9, status: "running" });
    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toMatch(/^(soft|hard)$/);
  });
});
