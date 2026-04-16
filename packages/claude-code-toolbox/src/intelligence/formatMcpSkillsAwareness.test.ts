import { describe, expect, it } from "vitest";
import type { HubPayload } from "../webview/mcpSkillsHubView";
import {
  formatMcpSkillsAwarenessMarkdown,
  formatMcpSkillsClaudeMdBlock,
} from "./formatMcpSkillsAwareness";

describe("formatMcpSkillsAwarenessMarkdown", () => {
  it("includes MCP tables and skill lists", () => {
    const payload: HubPayload = {
      workspaceName: "demo",
      workspaceServers: [{ id: "s1", kind: "stdio", detail: "node x.js", scope: "workspace" }],
      userServers: [],
      workspaceMcp: "ok",
      userMcp: "empty",
      skills: [
        {
          id: "w:/a",
          name: "my-skill",
          description: "Does things",
          rootPath: "/ws/.agents/skills/my-skill",
          skillMdPath: "/ws/.agents/skills/my-skill/SKILL.md",
          scope: "workspace",
        },
      ],
      kit: [],
      autoScanMcpSkillsOnWorkspaceOpen: false,
      thinkingMachineModeEnabled: false,
      hygiene: {
        workspaceMcpServerCount: 1,
        userMcpServerCount: 0,
        claudeMdLines: 10,
        claudeMdMissing: false,
      },
    };
    const md = formatMcpSkillsAwarenessMarkdown(payload, {
      userMcpPath: "/home/u/mcp.json",
      workspaceMcpPath: "/ws/.vscode/mcp.json",
      workspaceName: "demo",
    });
    expect(md).toContain("s1");
    expect(md).toContain("stdio");
    expect(md).toContain("my-skill");
    expect(md).toContain("Claude Code");
    expect(md).toContain("does not auto-load");
  });

  it("separates hub-off skills in the report", () => {
    const payload: HubPayload = {
      workspaceName: "demo",
      workspaceServers: [],
      userServers: [],
      workspaceMcp: "empty",
      userMcp: "empty",
      skills: [
        {
          id: "workspace:/ws/.agents/skills/on",
          name: "on-skill",
          description: "Active",
          rootPath: "/ws/.agents/skills/on",
          skillMdPath: "/ws/.agents/skills/on/SKILL.md",
          scope: "workspace",
        },
        {
          id: "workspace:/ws/.agents/skills/off",
          name: "off-skill",
          description: "Hidden in hub",
          rootPath: "/ws/.agents/skills/off",
          skillMdPath: "/ws/.agents/skills/off/SKILL.md",
          scope: "workspace",
          disabled: true,
        },
      ],
      kit: [],
      autoScanMcpSkillsOnWorkspaceOpen: false,
      thinkingMachineModeEnabled: false,
      hygiene: {
        workspaceMcpServerCount: 0,
        userMcpServerCount: 0,
        claudeMdLines: null,
        claudeMdMissing: true,
      },
    };
    const md = formatMcpSkillsAwarenessMarkdown(payload, {
      userMcpPath: "/home/u/mcp.json",
      workspaceMcpPath: "/ws/.vscode/mcp.json",
      workspaceName: "demo",
    });
    expect(md).toContain("on-skill");
    expect(md).toContain("off-skill");
    expect(md).toMatch(/off.*hub/i);
  });
});

describe("formatMcpSkillsClaudeMdBlock", () => {
  it("includes compact MCP tables and skills", () => {
    const payload: HubPayload = {
      workspaceName: "demo",
      workspaceServers: [{ id: "s1", kind: "stdio", detail: "node x.js", scope: "workspace" }],
      userServers: [],
      workspaceMcp: "ok",
      userMcp: "empty",
      skills: [
        {
          id: "w:/a",
          name: "my-skill",
          description: "Does things",
          rootPath: "/ws/.agents/skills/my-skill",
          skillMdPath: "/ws/.agents/skills/my-skill/SKILL.md",
          scope: "workspace",
        },
      ],
      kit: [],
      autoScanMcpSkillsOnWorkspaceOpen: false,
      thinkingMachineModeEnabled: false,
      hygiene: {
        workspaceMcpServerCount: 1,
        userMcpServerCount: 0,
        claudeMdLines: 10,
        claudeMdMissing: false,
      },
    };
    const md = formatMcpSkillsClaudeMdBlock(payload, {
      userMcpPath: "/home/u/mcp.json",
      workspaceMcpPath: "/ws/.vscode/mcp.json",
      workspaceName: "demo",
    });
    expect(md).toContain("s1");
    expect(md).toContain("my-skill");
    expect(md).toContain("MCP & Skills awareness");
    expect(md).toContain("cloude-code-toolbox-mcp-skills-awareness.md");
    expect(md).toContain("Confluence");
  });
});
