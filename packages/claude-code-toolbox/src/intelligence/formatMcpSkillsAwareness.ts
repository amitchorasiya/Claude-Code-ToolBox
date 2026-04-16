import type { HubPayload } from "../webview/mcpSkillsHubView";
import { MCP_SKILLS_AWARENESS_RELATIVE } from "./awarenessWorkspaceFile";

export type AwarenessPaths = {
  userMcpPath: string;
  workspaceMcpPath?: string;
  workspaceName?: string;
};

function activeMcp(rows: HubPayload["workspaceServers"]): HubPayload["workspaceServers"] {
  return rows.filter((s) => !s.disabled);
}

function disabledMcp(rows: HubPayload["workspaceServers"]): HubPayload["workspaceServers"] {
  return rows.filter((s) => s.disabled);
}

function activeSkills(skills: HubPayload["skills"]): HubPayload["skills"] {
  return skills.filter((s) => !s.disabled);
}

function hubOffSkills(skills: HubPayload["skills"]): HubPayload["skills"] {
  return skills.filter((s) => s.disabled);
}

function mcpFileLine(status: HubPayload["workspaceMcp"] | HubPayload["userMcp"], filePath: string): string {
  const label =
    status === "missing"
      ? "File missing"
      : status === "empty"
        ? "File exists — no servers defined"
        : "File exists — servers defined";
  return `- **${filePath}** — _${label}_`;
}

export function formatMcpSkillsAwarenessMarkdown(payload: HubPayload, paths: AwarenessPaths): string {
  const ts = new Date().toISOString();
  const lines: string[] = [
    "# Cloude Code ToolBox — MCP & Skills awareness",
    "",
    `_Generated: ${ts}_`,
    "",
    "## How to use this report",
    "",
    `- **Saved copy:** This file is **\`${MCP_SKILLS_AWARENESS_RELATIVE}\`** — refreshed whenever the toolbox runs an MCP & Skills scan (including on workspace open when auto-scan is enabled). It is meant for **Claude Code workspace context** together with \`CLAUDE.md\` (which gets a shorter replaceable summary when auto-merge is on).`,
    "- **MCP:** Lists **configured** servers from VS Code `mcp.json`. **Claude Code** uses `~/.claude/settings.json` and `/mcp` in the panel for its own MCP list — align or port configs as needed.",
    "- **Skills:** **On-disk** folders with `SKILL.md`. Claude Code does not auto-load them; attach `SKILL.md` or paths in chat when useful.",
    "- **Task routing:** When the user’s request matches a server’s purpose (e.g. Confluence → Confluence/Atlassian MCP), prefer that **server id** from the tables below.",
    "",
    "---",
    "",
    "## MCP — workspace",
    "",
  ];

  if (paths.workspaceMcpPath) {
    const wsLabel = payload.workspaceName ? ` _(folder: ${payload.workspaceName})_` : "";
    lines.push(`Workspace \`mcp.json\`${wsLabel}`, "", mcpFileLine(payload.workspaceMcp, paths.workspaceMcpPath), "");
    const wsActive = activeMcp(payload.workspaceServers);
    const wsOff = disabledMcp(payload.workspaceServers);
    if (wsActive.length === 0) {
      lines.push("_No active workspace servers in mcp.json._", "");
    } else {
      lines.push("| Server id | Kind | Detail |", "|-----------|------|--------|");
      for (const s of wsActive) {
        const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
      }
      lines.push("");
    }
    if (wsOff.length > 0) {
      lines.push(
        "_Servers **off** (config in Cloude Code ToolBox until you Turn ON in the hub):_",
        ""
      );
      lines.push("| Server id | Kind | Detail |", "|-----------|------|--------|");
      for (const s of wsOff) {
        const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
      }
      lines.push("");
    }
  } else {
    lines.push("_No workspace folder open — workspace `mcp.json` not scanned._", "");
  }

  lines.push("## MCP — user profile", "", mcpFileLine(payload.userMcp, paths.userMcpPath), "");

  const usActive = activeMcp(payload.userServers);
  const usOff = disabledMcp(payload.userServers);
  if (usActive.length === 0) {
    lines.push("_No active user-scoped servers in mcp.json._", "");
  } else {
    lines.push("| Server id | Kind | Detail |", "|-----------|------|--------|");
    for (const s of usActive) {
      const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
    }
    lines.push("");
  }
  if (usOff.length > 0) {
    lines.push("_User servers **off** (Toolbox stash):_", "", "| Server id | Kind | Detail |", "|-----------|------|--------|");
    for (const s of usOff) {
      const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
    }
    lines.push("");
  }

  lines.push("## Skills (local `SKILL.md` folders)", "");

  const wsAll = payload.skills.filter((s) => s.scope === "workspace");
  const userAll = payload.skills.filter((s) => s.scope === "user");
  const wsSkills = activeSkills(wsAll);
  const wsHubOff = hubOffSkills(wsAll);
  const userSkills = activeSkills(userAll);
  const userHubOff = hubOffSkills(userAll);

  if (wsAll.length === 0) {
    lines.push("### Project-scoped", "", "_None found (or no workspace open)._", "");
  } else {
    lines.push("### Project-scoped", "");
    if (wsSkills.length === 0) {
      lines.push("_No project skills shown as **on** in the hub (folders may still be on disk)._", "");
    } else {
      for (const s of wsSkills) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, `  - ${s.description}`, "");
      }
    }
    if (wsHubOff.length > 0) {
      lines.push(
        "_Skills **off** in hub (still on disk; Cloude Code ToolBox hides them until Turn ON):_",
        ""
      );
      for (const s of wsHubOff) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, `  - ${s.description}`, "");
      }
      lines.push("");
    }
  }

  if (userAll.length === 0) {
    lines.push("### User-scoped", "", "_None found._", "");
  } else {
    lines.push("### User-scoped", "");
    if (userSkills.length === 0) {
      lines.push("_No user skills shown as **on** in the hub (folders may still be on disk)._", "");
    } else {
      for (const s of userSkills) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, `  - ${s.description}`, "");
      }
    }
    if (userHubOff.length > 0) {
      lines.push(
        "_User skills **off** in hub (still on disk until Turn ON in hub):_",
        ""
      );
      for (const s of userHubOff) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, `  - ${s.description}`, "");
      }
      lines.push("");
    }
  }

  lines.push(
    "---",
    "",
    "## Suggested next steps",
    "",
    "- **MCP:** Command Palette → `MCP: List Servers` (or this extension’s hub **MCP** tab). In Claude Code, use `/mcp` to connect servers for the Claude session.",
    "- **Edit config:** `MCP: Open Workspace Folder MCP Configuration` / `MCP: Open User Configuration`.",
    "- **Refresh this report:** run **Intelligence — scan MCP & Skills awareness** again after changing `mcp.json` or adding skills.",
    "",
    "_Report from Cloude Code ToolBox extension._",
    ""
  );

  return lines.join("\n");
}

function mcpStatusLabel(status: HubPayload["workspaceMcp"] | HubPayload["userMcp"]): string {
  if (status === "missing") {
    return "file missing";
  }
  if (status === "empty") {
    return "no servers defined";
  }
  return "servers defined";
}

/** Compact section for `CLAUDE.md` (replaceable HTML-comment block). */
export function formatMcpSkillsClaudeMdBlock(
  payload: HubPayload,
  paths: AwarenessPaths
): string {
  const ts = new Date().toISOString();
  const lines: string[] = [
    "### MCP & Skills awareness (Cloude Code ToolBox)",
    "",
    `_Last synced: ${ts}._`,
    "",
    `- **Full report:** \`${MCP_SKILLS_AWARENESS_RELATIVE}\` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.`,
    "- **MCP:** For **live tools** in Claude Code, enable the matching server via `/mcp` (and VS Code `mcp.json` where applicable).",
    "- **When the user’s task matches a server** (e.g. Confluence work and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on tool use—not only file search.",
    "- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.",
    "",
    "#### Workspace MCP",
    "",
  ];

  if (paths.workspaceMcpPath) {
    const wsNote = payload.workspaceName ? ` _(workspace: ${payload.workspaceName})_` : "";
    lines.push(
      `- \`${paths.workspaceMcpPath}\`${wsNote} — _${mcpStatusLabel(payload.workspaceMcp)}_`,
      ""
    );
    const wsA = activeMcp(payload.workspaceServers);
    const wsD = disabledMcp(payload.workspaceServers);
    if (wsA.length === 0) {
      lines.push("_No active workspace servers in mcp.json._", "");
    } else {
      lines.push("| Server id | Kind | Detail |", "|-----------|------|--------|");
      for (const s of wsA) {
        const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
        lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
      }
      lines.push("");
    }
    if (wsD.length > 0) {
      lines.push("_Off (Toolbox stash):_ ", "");
      for (const s of wsD) {
        lines.push(`- **${s.id}** (${s.kind})`);
      }
      lines.push("");
    }
  } else {
    lines.push("_No workspace folder open — workspace `mcp.json` not scanned._", "");
  }

  lines.push(
    "#### User MCP",
    "",
    `- \`${paths.userMcpPath}\` — _${mcpStatusLabel(payload.userMcp)}_`,
    ""
  );
  const usA = activeMcp(payload.userServers);
  const usD = disabledMcp(payload.userServers);
  if (usA.length === 0) {
    lines.push("_No active user-scoped servers in mcp.json._", "");
  } else {
    lines.push("| Server id | Kind | Detail |", "|-----------|------|--------|");
    for (const s of usA) {
      const det = s.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${s.id} | ${s.kind} | ${det} |`);
    }
    lines.push("");
  }
  if (usD.length > 0) {
    lines.push("_Off (Toolbox stash):_ ", "");
    for (const s of usD) {
      lines.push(`- **${s.id}** (${s.kind})`);
    }
    lines.push("");
  }

  const wsAll = payload.skills.filter((s) => s.scope === "workspace");
  const userAll = payload.skills.filter((s) => s.scope === "user");
  const wsSkills = activeSkills(wsAll);
  const wsHubOff = hubOffSkills(wsAll);
  const userSkills = activeSkills(userAll);
  const userHubOff = hubOffSkills(userAll);

  lines.push("#### Project skills", "");
  if (wsAll.length === 0) {
    lines.push("_None found (or no workspace open)._", "");
  } else {
    if (wsSkills.length === 0) {
      lines.push("_All hidden in hub (Turn OFF) or none listed._", "");
    } else {
      for (const s of wsSkills) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\` — ${s.description}`, "");
      }
    }
    if (wsHubOff.length > 0) {
      lines.push("_Off in hub (on disk):_ ", "");
      for (const s of wsHubOff) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, "");
      }
      lines.push("");
    }
  }

  lines.push("#### User skills", "");
  if (userAll.length === 0) {
    lines.push("_None found._", "");
  } else {
    if (userSkills.length === 0) {
      lines.push("_All hidden in hub (Turn OFF) or none listed._", "");
    } else {
      for (const s of userSkills) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\` — ${s.description}`, "");
      }
    }
    if (userHubOff.length > 0) {
      lines.push("_Off in hub (on disk):_ ", "");
      for (const s of userHubOff) {
        lines.push(`- **${s.name}** — \`${s.rootPath}\``, "");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
