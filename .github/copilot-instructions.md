# GitHub Copilot instructions

<!-- github-copilot-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (GitHub Copilot Toolbox)

_Last synced: 2026-04-16T15:42:49.345Z._

- **Full report:** `.github/copilot-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools**, use **Copilot Chat → Agent** and **trust/start** the right servers in the MCP UI.
- **When the user’s task matches a server** (e.g. “open this Confluence page” and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on Agent + MCP for actions—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `/Users/amitchorasiya/Documents/Claude-Code-ToolBox/.vscode/mcp.json` _(workspace: Claude-Code-ToolBox)_ — _file missing_

_No active workspace servers in mcp.json._

#### User MCP

- `/Users/amitchorasiya/Library/Application Support/Code/User/mcp.json` — _servers defined_

| Server id | Kind | Detail |
|-----------|------|--------|
| atlassian | http | https://mcp.atlassian.com/v1/mcp |
| snyk | stdio | /Users/amitchorasiya/Library/Application Support/snyk/vscode-cli/snyk-macos-arm64 mcp -t stdio |
| postgres | http | https://waystation.ai/postgres/mcp |
| confluenceMcp | stdio | /Users/amitchorasiya/Documents/AIC/mcp-servers/confluence-token-mcp/.venv/bin/python -m confluence_token_mcp.server |

#### Project skills

_None found (or no workspace open)._

#### User skills

- **blog** — `/Users/amitchorasiya/.agents/skills/blog` — Write and publish blog posts about app development, technical decisions, and lessons learned. Use when the user wants to write a blog post, article, dev journal entry, publish to Confluence or Substack, or share learning

- **confluence-publish** — `/Users/amitchorasiya/.agents/skills/confluence-publish` — Publishes markdown to Confluence using Atlassian MCP and/or REST attachment upload. Covers Python Mermaid-to-PNG, wiki download URLs, and fixing Preview unavailable for images. Use when syncing a post to Confluence or de

- **cpa-tax-reviewer** — `/Users/amitchorasiya/.agents/skills/cpa-tax-reviewer` — You are a highly skilled **CPA Tax Reviewer Agent**. Your goal is to audit US Federal (IRS) and State (Pennsylvania) tax returns for accuracy, compliance, and missed savings.

- **create-skill** — `/Users/amitchorasiya/.agents/skills/create-skill` — Create new Cursor agent skills from scratch. Use when the user wants to create a skill, build a new agent capability, set up a workflow skill, or asks about SKILL.md structure.

- **design-md** — `/Users/amitchorasiya/.agents/skills/design-md` — Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files

- **frontend-design** — `/Users/amitchorasiya/.agents/skills/frontend-design` — Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing

- **mermaid-to-png** — `/Users/amitchorasiya/.agents/skills/mermaid-to-png` — Renders Mermaid diagram source to PNG using Python and Playwright (local Chromium, no Kroki). Use when exporting diagrams for Confluence, fixing broken Mermaid previews, or the user forbids third-party diagram APIs.

- **snyk-rules** — `/Users/amitchorasiya/.agents/skills/snyk-rules` — After making any code changes, ensure best security practices are met

- **blog** — `/Users/amitchorasiya/.cursor/skills/blog` — Write and publish blog posts about app development, technical decisions, and lessons learned. Use when the user wants to write a blog post, article, dev journal entry, publish to Confluence or Substack, or share learning

- **confluence-publish** — `/Users/amitchorasiya/.cursor/skills/confluence-publish` — Publishes content to Confluence with reliable diagram embeds. Covers Mermaid → PNG (Playwright), confluence-token MCP (upload + storage XML with ri:attachment), wiki URL pitfalls, and optional md2cf/REST. Use when syncin

- **cpa-tax-reviewer** — `/Users/amitchorasiya/.cursor/skills/cpa-tax-reviewer` — You are a highly skilled **CPA Tax Reviewer Agent**. Your goal is to audit US Federal (IRS) and State (Pennsylvania) tax returns for accuracy, compliance, and missed savings.

- **create-skill** — `/Users/amitchorasiya/.cursor/skills/create-skill` — Create new Cursor agent skills from scratch. Use when the user wants to create a skill, build a new agent capability, set up a workflow skill, or asks about SKILL.md structure.

- **design-md** — `/Users/amitchorasiya/.cursor/skills/design-md` — Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files

- **frontend-design** — `/Users/amitchorasiya/.cursor/skills/frontend-design` — Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing

- **mermaid-to-png** — `/Users/amitchorasiya/.cursor/skills/mermaid-to-png` — Renders Mermaid diagram source to PNG using Python and Playwright (local Chromium, no Kroki). Use when exporting diagrams for Confluence, fixing broken Mermaid previews, or the user forbids third-party diagram APIs.

- **publish-disclaimers** — `/Users/amitchorasiya/.cursor/skills/publish-disclaimers` — Adds publish-ready disclaimer sections (independence, trademarks, MIT or license warranty, third parties, user responsibility) to READMEs, package metadata, and static sites for software the user ships. Use when preparin

- **snyk-rules** — `/Users/amitchorasiya/.cursor/skills/snyk-rules` — After making any code changes, ensure best security practices are met

<!-- github-copilot-toolbox:mcp-skills-awareness-end -->
