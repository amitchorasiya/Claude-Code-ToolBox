import * as vscode from "vscode";

/** Runs the first task whose name or definition looks like a test task, else the first workspace task. */
export async function runFirstWorkspaceTestTask(): Promise<void> {
  const tasks = await vscode.tasks.fetchTasks();
  const testTasks = tasks.filter(
    (t) => /test|vitest|jest|pytest|mocha/i.test(t.name) || /test/i.test(String(t.definition.type))
  );
  const t0 = testTasks[0] ?? tasks[0];
  if (!t0) {
    vscode.window.showWarningMessage("No tasks found in this workspace.");
    return;
  }
  await vscode.tasks.executeTask(t0);
  vscode.window.showInformationMessage(`Started task: ${t0.name}`);
}
