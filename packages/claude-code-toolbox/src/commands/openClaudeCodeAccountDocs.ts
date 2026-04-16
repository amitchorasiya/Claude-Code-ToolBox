import * as vscode from "vscode";

export async function openClaudeCodeAccountDocs(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "Claude Code docs (VS Code)",
        detail: "https://code.claude.com/docs/en/vs-code/",
        target: "https://code.claude.com/docs/en/vs-code/",
      },
      {
        label: "Anthropic — Plans & pricing",
        detail: "https://www.anthropic.com/pricing",
        target: "https://www.anthropic.com/pricing",
      },
    ],
    { title: "Claude Code — account & docs" }
  );
  if (!pick) {
    return;
  }
  await vscode.env.openExternal(vscode.Uri.parse(pick.target));
}
