import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import * as mcpPaths from "../mcpPaths";

type RecipeFile = {
  recipes: Array<{
    id: string;
    label: string;
    description?: string;
    serverKey: string;
    config: Record<string, unknown>;
  }>;
};

async function deepReplaceInputs(
  obj: unknown,
  prompt: (key: string, desc: string) => Promise<string | undefined>
): Promise<unknown> {
  if (typeof obj === "string") {
    const m = obj.match(/^\$\{input:([^}]+)\}$/);
    if (m) {
      const key = m[1].trim();
      return (await prompt(key, `Value for ${key}`)) ?? "";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((x) => deepReplaceInputs(x, prompt)));
  }
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = await deepReplaceInputs(o[k], prompt);
    }
    return out;
  }
  return obj;
}

/** Merge a bundled MCP recipe into workspace `.vscode/mcp.json`. */
export async function applyBundledMcpRecipe(context: vscode.ExtensionContext): Promise<void> {
  const folder = mcpPaths.getPrimaryWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }
  const jsonPath = path.join(context.extensionPath, "resources", "mcp-recipes", "bundled-recipes.json");
  let raw: string;
  try {
    raw = fs.readFileSync(jsonPath, "utf8");
  } catch {
    vscode.window.showErrorMessage("Bundled MCP recipes missing from extension.");
    return;
  }
  let data: RecipeFile;
  try {
    data = JSON.parse(raw) as RecipeFile;
  } catch {
    vscode.window.showErrorMessage("Invalid bundled recipes JSON.");
    return;
  }
  if (!Array.isArray(data.recipes) || data.recipes.length === 0) {
    vscode.window.showErrorMessage("No recipes defined.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    data.recipes.map((r) => ({
      label: r.label,
      description: r.id,
      detail: r.description,
      recipe: r,
    })),
    { title: "Apply bundled MCP recipe to workspace" }
  );
  if (!choice) {
    return;
  }

  const prompt = async (key: string, desc: string): Promise<string | undefined> => {
    return vscode.window.showInputBox({ prompt: desc, placeHolder: key, ignoreFocusOut: true });
  };

  const mergedConfig = (await deepReplaceInputs(
    choice.recipe.config,
    prompt
  )) as Record<string, unknown>;

  const mcpUri = mcpPaths.workspaceMcpUri(folder);
  let root: { servers?: Record<string, unknown> };
  try {
    const buf = await vscode.workspace.fs.readFile(mcpUri);
    const parsed = JSON.parse(new TextDecoder().decode(buf)) as { servers?: Record<string, unknown> };
    root = {
      servers:
        parsed.servers && typeof parsed.servers === "object" && !Array.isArray(parsed.servers)
          ? { ...parsed.servers }
          : {},
    };
  } catch {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, ".vscode"));
    root = { servers: {} };
  }

  const key = choice.recipe.serverKey.trim();
  if (!key) {
    vscode.window.showErrorMessage("Invalid recipe serverKey.");
    return;
  }
  if (root.servers![key]) {
    const ok = await vscode.window.showWarningMessage(
      `Server "${key}" already exists in mcp.json. Overwrite?`,
      { modal: true },
      "Overwrite",
      "Cancel"
    );
    if (ok !== "Overwrite") {
      return;
    }
  }
  root.servers![key] = mergedConfig;

  const out = JSON.stringify(root, null, 2) + "\n";
  const preview = await vscode.workspace.openTextDocument({
    content: out,
    language: "json",
  });
  await vscode.window.showTextDocument(preview, { preview: true });
  const apply = await vscode.window.showWarningMessage(
    "Write merged mcp.json to .vscode/mcp.json?",
    { modal: true },
    "Write",
    "Cancel"
  );
  if (apply !== "Write") {
    return;
  }
  const enc = new TextEncoder();
  await vscode.workspace.fs.writeFile(mcpUri, enc.encode(out));
  vscode.window.showInformationMessage(`Updated .vscode/mcp.json (server "${key}").`);
}
