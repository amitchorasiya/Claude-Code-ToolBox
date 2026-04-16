import * as vscode from "vscode";

const ITEMS = [
  "Tests: ran or will run before merge",
  "Review: self-reviewed diff / critical paths",
  "Security: no secrets pasted into chat or committed",
  "Docs: user-facing changes noted if needed",
] as const;

/** Lightweight pre-ship checklist (workflow pattern similar to agent verification loops). */
export async function runVerificationChecklist(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    ITEMS.map((label) => ({ label, picked: false })),
    {
      title: "Verification checklist (Cloude Code ToolBox)",
      canPickMany: true,
      placeHolder: "Check what applies, then press Enter",
    }
  );
  if (picked === undefined) {
    return;
  }
  if (picked.length === 0) {
    vscode.window.showInformationMessage("Verification: no items checked.");
  } else {
    vscode.window.showInformationMessage(`Verification: ${picked.length} item(s) acknowledged.`);
  }
}
