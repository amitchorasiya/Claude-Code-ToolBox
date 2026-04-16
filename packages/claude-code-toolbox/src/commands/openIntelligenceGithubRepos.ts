import * as vscode from "vscode";

const INTELLIGENCE_REPOS: Record<string, { url: string; label: string; description: string }> = {
  mcpPort: {
    url: "https://github.com/amitchorasiya/Github-Copilot-ToolBox",
    label: "MCP port CLI (cursor-mcp-to-github-copilot-port)",
    description: "Github-Copilot-ToolBox",
  },
  memoryBank: {
    url: "https://github.com/amitchorasiya/Github-Copilot-Memory-Bank",
    label: "Memory bank CLI (github-copilot-memory-bank)",
    description: "Github-Copilot-Memory-Bank",
  },
  rulesConverter: {
    url: "https://github.com/amitchorasiya/Github-Copilot-Cursor-Rules-Converter",
    label: "Cursor rules → Copilot CLI (cursor-rules-to-github-copilot)",
    description: "Github-Copilot-Cursor-Rules-Converter",
  },
};

/** Companion repo URLs (for tests and callers that only need URLs). */
export const INTELLIGENCE_BRIDGE_REPOS = {
  mcpPort: INTELLIGENCE_REPOS.mcpPort.url,
  memoryBank: INTELLIGENCE_REPOS.memoryBank.url,
  rulesConverter: INTELLIGENCE_REPOS.rulesConverter.url,
} as const;

type RepoPick = vscode.QuickPickItem & { id: string };

/**
 * Opens one GitHub repo by id (`mcpPort` | `memoryBank` | `rulesConverter`), or shows a quick pick when `pref` is omitted/unknown.
 */
export async function openIntelligenceToolboxRepos(pref?: string): Promise<void> {
  const row = pref && INTELLIGENCE_REPOS[pref];
  if (row) {
    await vscode.env.openExternal(vscode.Uri.parse(row.url));
    return;
  }
  const picked = await vscode.window.showQuickPick<RepoPick>(
    Object.entries(INTELLIGENCE_REPOS).map(([id, v]) => ({
      label: v.label,
      description: v.description,
      id,
    })),
    { placeHolder: "Open a Toolbox CLI repository on GitHub" }
  );
  if (picked) {
    await vscode.env.openExternal(vscode.Uri.parse(INTELLIGENCE_REPOS[picked.id].url));
  }
}

export async function openIntelligenceRepoMcpPort(): Promise<void> {
  await openIntelligenceToolboxRepos("mcpPort");
}

export async function openIntelligenceRepoMemoryBank(): Promise<void> {
  await openIntelligenceToolboxRepos("memoryBank");
}

export async function openIntelligenceRepoRulesConverter(): Promise<void> {
  await openIntelligenceToolboxRepos("rulesConverter");
}
