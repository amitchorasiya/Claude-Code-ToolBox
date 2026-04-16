/**
 * Minimal stub so Vitest can resolve `import from "vscode"`.
 * Extension code only runs inside VS Code; tests use pure modules or this stub.
 */
import * as path from "node:path";

export const Uri = {
  joinPath(uri: { fsPath: string }, ...pathSegments: string[]): { fsPath: string } {
    return { fsPath: path.join(uri.fsPath, ...pathSegments) };
  },
};

export const workspace = {
  fs: {
    async stat(): Promise<{ type: number }> {
      throw new Error("vscode stub: workspace.fs.stat — not available in Vitest");
    },
    async createDirectory(): Promise<void> {
      /* no-op */
    },
    async readFile(): Promise<Uint8Array> {
      throw new Error("vscode stub: workspace.fs.readFile — not available in Vitest");
    },
    async writeFile(): Promise<void> {
      /* no-op */
    },
  },
};

export type WorkspaceFolder = { uri: { fsPath: string } };
