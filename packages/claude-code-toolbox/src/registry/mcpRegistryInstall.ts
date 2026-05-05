import * as vscode from "vscode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteText } from "../agents/atomicFile";
import { workspaceMcpUri, getPrimaryWorkspaceFolder } from "../mcpPaths";

/** Shape passed to vscode:mcp/install (VS Code merges this into MCP setup). */
export type VscodeMcpInstallConfig = {
  name: string;
  /** Remote MCP: VS Code expects http vs sse */
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Array<{ name: string; value: string }>;
};

export type InstallInputField = {
  id: string;
  description?: string;
  password?: boolean;
};

const INPUT_RE = /\$\{input:([^}]+)\}/g;

function replacePlaceholders(value: string, values: Map<string, string>): string {
  return value.replace(INPUT_RE, (_, rawId: string) => {
    const key = String(rawId ?? "").trim();
    return key ? (values.get(key) ?? "") : "";
  });
}

async function collectInstallInputs(inputs: InstallInputField[]): Promise<Map<string, string> | undefined> {
  const values = new Map<string, string>();
  for (const input of inputs) {
    if (values.has(input.id)) {
      continue;
    }
    const response = await vscode.window.showInputBox({
      prompt: input.description ?? `Value for ${input.id}`,
      password: input.password === true,
      ignoreFocusOut: true,
    });
    if (response === undefined) {
      return undefined;
    }
    values.set(input.id, response);
  }
  return values;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function pickStdioPackage(packages: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(packages) || packages.length === 0) {
    return undefined;
  }
  for (const p of packages) {
    const pr = asRecord(p);
    const transport = asRecord(pr?.transport);
    const t = String(transport?.type ?? "").toLowerCase();
    if (t === "stdio") {
      return pr;
    }
  }
  const first = asRecord(packages[0]);
  return first;
}

function runtimeCommandForPackage(pkg: Record<string, unknown>): string | undefined {
  const hint = typeof pkg.runtimeHint === "string" ? pkg.runtimeHint.trim() : "";
  if (hint) {
    return hint;
  }
  const rt = String(pkg.registryType ?? pkg.registry_type ?? "").toLowerCase();
  if (rt === "npm") {
    return "npx";
  }
  if (rt === "pypi") {
    return "uvx";
  }
  return undefined;
}

function collectArgInputs(pkg: Record<string, unknown>): { args: string[]; inputs: InstallInputField[] } {
  const args: string[] = [];
  const inputs: InstallInputField[] = [];
  let positional = 0;

  const pushList = (list: unknown) => {
    if (!Array.isArray(list)) {
      return;
    }
    for (const entry of list) {
      const e = asRecord(entry);
      if (!e) {
        continue;
      }
      const type = String(e.type ?? "");
      const name = typeof e.name === "string" ? e.name : "";
      const value = typeof e.value === "string" ? e.value : "";
      const def = typeof e.default === "string" ? e.default : "";
      const hint = typeof e.valueHint === "string" ? e.valueHint : typeof e.value_hint === "string" ? e.value_hint : "";
      const desc = typeof e.description === "string" ? e.description : undefined;
      const secret = Boolean(e.isSecret ?? e.is_secret);

      if (type === "positional") {
        if (value) {
          args.push(value);
        } else if (hint || def) {
          args.push(hint || def);
        } else {
          const id = `arg_pos_${positional++}`;
          inputs.push({ id, description: desc ?? "Positional argument", password: secret });
          args.push(`\${input:${id}}`);
        }
      } else if (type === "named") {
        if (name) {
          args.push(name);
        }
        if (value) {
          args.push(value);
        } else if (hint || def) {
          args.push(hint || def);
        } else {
          const id = `arg_${name.replace(/[^a-zA-Z0-9_]+/g, "_") || `n${positional++}`}`;
          inputs.push({ id, description: desc ?? `Value for ${name}`, password: secret });
          args.push(`\${input:${id}}`);
        }
      }
    }
  };

  pushList(pkg.runtimeArguments ?? pkg.runtime_arguments);
  pushList(pkg.packageArguments ?? pkg.package_arguments);
  return { args, inputs };
}

function collectEnvInputs(pkg: Record<string, unknown>): { env: Record<string, string>; inputs: InstallInputField[] } {
  const env: Record<string, string> = {};
  const inputs: InstallInputField[] = [];
  const list = pkg.environmentVariables ?? pkg.environment_variables;
  if (!Array.isArray(list)) {
    return { env, inputs };
  }
  for (const row of list) {
    const v = asRecord(row);
    const key = typeof v?.name === "string" ? v.name.trim() : "";
    if (!key) {
      continue;
    }
    const val = typeof v?.value === "string" ? v.value : "";
    const def = typeof v?.default === "string" ? v.default : "";
    const desc = typeof v?.description === "string" ? v.description : undefined;
    const secret = Boolean(v?.isSecret ?? v?.is_secret);
    if (val || def) {
      env[key] = val || def;
    } else {
      inputs.push({ id: key, description: desc ?? key, password: secret });
      env[key] = `\${input:${key}}`;
    }
  }
  return { env, inputs };
}

function ensureBaseArgs(command: string, identifier: string | undefined, version: string | undefined, args: string[]): string[] {
  if (!identifier) {
    return args;
  }
  if (command === "npx") {
    const spec = version && version !== "latest" ? `${identifier}@${version}` : identifier;
    if (!args.some((a) => typeof a === "string" && a.includes(identifier))) {
      return [spec, ...args];
    }
  }
  if (command === "uvx") {
    const spec =
      version && version !== "latest" && version !== ""
        ? `${identifier}==${version}`
        : identifier;
    if (!args.some((a) => typeof a === "string" && a.includes(identifier))) {
      return [spec, ...args];
    }
  }
  return args;
}

function buildStdioFromPackage(
  serverName: string,
  pkg: Record<string, unknown>
): { config: VscodeMcpInstallConfig; inputs: InstallInputField[] } | { error: string } {
  const command = runtimeCommandForPackage(pkg);
  if (!command) {
    return { error: "No supported runtime (npx/uvx) for this package." };
  }
  const identifier = typeof pkg.identifier === "string" ? pkg.identifier : "";
  const version = typeof pkg.version === "string" ? pkg.version : undefined;
  const { args, inputs: aIn } = collectArgInputs(pkg);
  const { env, inputs: eIn } = collectEnvInputs(pkg);
  const mergedInputs = [...aIn, ...eIn];
  const finalArgs = ensureBaseArgs(command, identifier || undefined, version, args);
  const name =
    identifier.split("/").pop()?.replace(/^@/, "") || serverName.split("/").pop() || serverName || "mcp-server";
  const config: VscodeMcpInstallConfig = {
    name: name.slice(0, 120),
    command,
    args: finalArgs.length > 0 ? finalArgs : undefined,
    env: Object.keys(env).length > 0 ? env : undefined,
  };
  return { config, inputs: mergedInputs };
}

function buildRemoteFromEntry(
  serverName: string,
  remote: Record<string, unknown>
): { config: VscodeMcpInstallConfig; inputs: InstallInputField[] } | { error: string } {
  const url = typeof remote.url === "string" ? remote.url.trim() : "";
  if (!url) {
    return { error: "Remote entry has no URL." };
  }
  const rawType = String(remote.type ?? "http").toLowerCase();
  if (rawType !== "streamable-http" && rawType !== "sse") {
    return { error: `Remote type "${rawType}" is not supported for one-click install.` };
  }
  const headersIn = remote.headers;
  const headers: Array<{ name: string; value: string }> = [];
  const inputs: InstallInputField[] = [];
  if (Array.isArray(headersIn)) {
    for (const h of headersIn) {
      const hr = asRecord(h);
      const hn = typeof hr?.name === "string" ? hr.name.trim() : "";
      if (!hn) {
        continue;
      }
      const hv = typeof hr?.value === "string" ? hr.value : typeof hr?.default === "string" ? hr.default : "";
      const desc = typeof hr?.description === "string" ? hr.description : undefined;
      const secret = Boolean(hr?.isSecret ?? hr?.is_secret);
      if (!hv || hv.includes("{") || hv.includes("${")) {
        const id = `hdr_${hn.replace(/[^a-zA-Z0-9_]+/g, "_")}`;
        inputs.push({ id, description: desc ?? `Header ${hn}`, password: secret });
        headers.push({ name: hn, value: hv || `\${input:${id}}` });
      } else {
        headers.push({ name: hn, value: hv });
      }
    }
  }
  const transportType = rawType === "sse" ? "sse" : "http";
  const config: VscodeMcpInstallConfig = {
    name: serverName.split("/").pop() || serverName,
    type: transportType,
    url,
    headers: headers.length > 0 ? headers : undefined,
  };
  return { config, inputs };
}

/**
 * Normalize registry list item to `{ server, _meta }` or bare server object.
 */
export function unwrapRegistryEntry(entry: unknown): { server: Record<string, unknown>; remotes: unknown[]; packages: unknown[] } {
  const root = asRecord(entry) ?? {};
  const server = asRecord(root.server) ?? root;
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const name = typeof server.name === "string" ? server.name : "server";
  return { server: { ...server, name }, remotes, packages };
}

type InstallScope = "user" | "project";

async function writeToClaudeConfig(
  scope: InstallScope,
  serverName: string,
  serverConfig: Record<string, unknown>
): Promise<boolean> {
  if (scope === "user") {
    const claudeJsonPath = path.join(os.homedir(), ".claude.json");
    let existing: Record<string, unknown> = {};
    try {
      const raw = fs.readFileSync(claudeJsonPath, "utf8");
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // file missing or invalid — start fresh
    }
    const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
    if (serverName in mcpServers) {
      const overwrite = await vscode.window.showWarningMessage(
        `Server "${serverName}" already exists in ~/.claude.json. Overwrite?`,
        "Yes",
        "No"
      );
      if (overwrite !== "Yes") {
        return false;
      }
    }
    mcpServers[serverName] = serverConfig;
    existing.mcpServers = mcpServers;
    await atomicWriteText(claudeJsonPath, JSON.stringify(existing, null, 2) + "\n");
    return true;
  }

  // project scope
  const folder = getPrimaryWorkspaceFolder();
  if (!folder) {
    void vscode.window.showErrorMessage("No workspace folder open for project MCP install.");
    return false;
  }
  const mcpUri = workspaceMcpUri(folder);
  const mcpPath = mcpUri.fsPath;
  let existing: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(mcpPath, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // file missing — start fresh
  }
  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers[serverName] = serverConfig;
  existing.mcpServers = mcpServers;
  await atomicWriteText(mcpPath, JSON.stringify(existing, null, 2) + "\n");
  return true;
}

export async function installMcpFromRegistryEntry(entry: unknown): Promise<boolean> {
  const { server, remotes, packages } = unwrapRegistryEntry(entry);
  const serverName = typeof server.name === "string" ? server.name : "mcp-server";

  const pkg = pickStdioPackage(packages);
  let built:
    | { config: VscodeMcpInstallConfig; inputs: InstallInputField[] }
    | { error: string }
    | undefined;

  if (pkg) {
    built = buildStdioFromPackage(serverName, pkg);
  } else if (remotes.length > 0) {
    const first = asRecord(remotes[0]);
    if (first) {
      built = buildRemoteFromEntry(serverName, first);
    }
  }

  if (!built) {
    void vscode.window.showErrorMessage("This registry entry has no installable stdio package or supported remote URL.");
    return false;
  }
  if ("error" in built) {
    void vscode.window.showErrorMessage(built.error);
    return false;
  }

  let config = built.config;
  if (built.inputs.length > 0) {
    const values = await collectInstallInputs(built.inputs);
    if (!values) {
      void vscode.window.showInformationMessage("MCP install cancelled.");
      return false;
    }
    if (config.args) {
      config = {
        ...config,
        args: config.args.map((a) => replacePlaceholders(a, values)),
      };
    }
    if (config.env) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(config.env)) {
        next[k] = replacePlaceholders(v, values);
      }
      config = { ...config, env: next };
    }
    if (config.headers) {
      config = {
        ...config,
        headers: config.headers.map((h) => ({
          ...h,
          value: replacePlaceholders(h.value ?? "", values),
        })),
      };
    }
  }

  // Ask user which scope to install to
  const scopePick = await vscode.window.showQuickPick(
    [
      { label: "User (~/.claude.json)", description: "Available in all projects", value: "user" as InstallScope },
      { label: "Project (.mcp.json)", description: "This workspace only", value: "project" as InstallScope },
    ],
    { title: `Install "${config.name}" to…`, placeHolder: "Choose scope" }
  );
  if (!scopePick) {
    return false;
  }

  // Build Claude Code server config object
  const serverConfig: Record<string, unknown> = {};
  if (config.command) {
    serverConfig.type = "stdio";
    serverConfig.command = config.command;
    if (config.args) {
      serverConfig.args = config.args;
    }
    if (config.env) {
      serverConfig.env = config.env;
    }
  } else if (config.url) {
    serverConfig.type = config.type === "sse" ? "sse" : "http";
    serverConfig.url = config.url;
    if (config.headers) {
      const headersObj: Record<string, string> = {};
      for (const h of config.headers) {
        headersObj[h.name] = h.value;
      }
      serverConfig.headers = headersObj;
    }
  }

  const ok = await writeToClaudeConfig(scopePick.value, config.name, serverConfig);
  if (ok) {
    void vscode.window.showInformationMessage(
      `Installed "${config.name}" to ${scopePick.value === "user" ? "~/.claude.json" : ".mcp.json"}`
    );
  }
  return ok;
}
