import * as os from "node:os";
import * as vscode from "vscode";

export type InstallSkillOpts = {
  source: string;
  skillId: string;
  global: boolean;
};

function shSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Runs the official `skills` CLI (MIT) to install into Cursor (+ others the CLI detects).
 * @see https://github.com/vercel-labs/skills
 */
export async function installSkillFromSkillsSh(opts: InstallSkillOpts): Promise<void> {
  const source = opts.source.trim();
  const skillId = opts.skillId.trim();
  if (!source || !skillId) {
    void vscode.window.showErrorMessage("Skill source and id are required.");
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!opts.global && !folder) {
    void vscode.window.showErrorMessage(
      "Open a workspace folder for a project install, or choose global install."
    );
    return;
  }

  const cwd = opts.global ? os.homedir() : folder!.uri.fsPath;
  const globalFlag = opts.global ? " -g" : "";
  const line = `npx -y skills add ${shSingleQuote(source)} --skill ${shSingleQuote(skillId)} -a cursor -y${globalFlag}`;

  const term = vscode.window.createTerminal({ name: "skills add", cwd });
  term.show(true);
  term.sendText(line, true);
  void vscode.window.showInformationMessage(
    "Running `npx skills add` in the terminal (Cursor agent). Complete any extra prompts there."
  );
}
