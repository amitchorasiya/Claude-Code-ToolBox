import * as vscode from "vscode";

const TERM_NAME = "Cloude Code ToolBox";

function quoteArg(arg: string): string {
  if (process.platform === "win32") {
    if (!/[\s"]/.test(arg)) {
      return arg;
    }
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  if (!/[\s'$]/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Runs npx in a terminal with cwd set (avoids embedding workspace path in npx args when possible).
 */
export function runNpxInTerminal(
  cwd: string,
  packageName: string,
  tag: string,
  args: string[],
  displayName: string
): void {
  const pkg = tag === "latest" ? `${packageName}@latest` : `${packageName}@${tag}`;
  const argLine = args.map(quoteArg).join(" ");
  const line = `npx ${pkg} ${argLine}`.trim();
  const term =
    vscode.window.terminals.find((t) => t.name === TERM_NAME) ??
    vscode.window.createTerminal({ name: TERM_NAME, cwd });
  term.show();
  term.sendText(line, true);
  vscode.window.showInformationMessage(`Running in terminal: ${displayName}`);
}
