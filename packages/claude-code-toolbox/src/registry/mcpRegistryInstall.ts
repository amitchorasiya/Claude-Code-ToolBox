import * as vscode from "vscode";

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

  const uriStr = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
  const ok = await vscode.env.openExternal(vscode.Uri.parse(uriStr));
  if (ok) {
    void vscode.window.showInformationMessage(`Opening VS Code MCP install for "${config.name}"…`);
  }
  return ok;
}
