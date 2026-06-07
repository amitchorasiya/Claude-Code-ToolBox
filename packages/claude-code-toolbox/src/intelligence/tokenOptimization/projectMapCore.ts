/**
 * Project map: file scanner, import/export regex parser, dependency graph builder.
 * Pure logic — no vscode imports.
 */

export type ImportRef = {
  source: string;
  symbols: string[];
};

export type ProjectNode = {
  relativePath: string;
  language: string;
  exports: string[];
  imports: ImportRef[];
  lineCount: number;
};

export type ProjectMap = {
  nodes: ProjectNode[];
  clusters: DependencyCluster[];
  generatedAt: string;
  totalFiles: number;
  tokenEstimate: number;
};

export type DependencyCluster = {
  name: string;
  files: string[];
};

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".cs": "csharp",
};

export function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return LANG_MAP[ext] ?? "unknown";
}

export function parseImportsExports(
  content: string,
  language: string
): { imports: ImportRef[]; exports: string[] } {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseTsJs(content);
    case "python":
      return parsePython(content);
    case "go":
      return parseGo(content);
    default:
      return { imports: [], exports: [] };
  }
}

function parseTsJs(content: string): { imports: ImportRef[]; exports: string[] } {
  const imports: ImportRef[] = [];
  const exports: string[] = [];

  const importRe = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const symbols = m[1]
      ? m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
      : [m[2]];
    imports.push({ source: m[3], symbols });
  }

  const sideEffectImportRe = /import\s+['"]([^'"]+)['"]/g;
  while ((m = sideEffectImportRe.exec(content)) !== null) {
    imports.push({ source: m[1], symbols: ["*"] });
  }

  const exportRe = /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g;
  while ((m = exportRe.exec(content)) !== null) {
    exports.push(m[1]);
  }

  return { imports, exports };
}

function parsePython(content: string): { imports: ImportRef[]; exports: string[] } {
  const imports: ImportRef[] = [];
  const exports: string[] = [];

  const fromImportRe = /from\s+([\w.]+)\s+import\s+(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = fromImportRe.exec(content)) !== null) {
    const symbols = m[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    imports.push({ source: m[1], symbols });
  }

  const importRe = /^import\s+([\w.]+)/gm;
  while ((m = importRe.exec(content)) !== null) {
    imports.push({ source: m[1], symbols: ["*"] });
  }

  const defRe = /^(?:def|class)\s+(\w+)/gm;
  while ((m = defRe.exec(content)) !== null) {
    exports.push(m[1]);
  }

  return { imports, exports };
}

function parseGo(content: string): { imports: ImportRef[]; exports: string[] } {
  const imports: ImportRef[] = [];
  const exports: string[] = [];

  const singleImportRe = /import\s+"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = singleImportRe.exec(content)) !== null) {
    imports.push({ source: m[1], symbols: ["*"] });
  }

  const blockImportRe = /import\s*\(([\s\S]*?)\)/g;
  while ((m = blockImportRe.exec(content)) !== null) {
    const lines = m[1].split("\n");
    for (const line of lines) {
      const pathMatch = line.match(/"([^"]+)"/);
      if (pathMatch) {
        imports.push({ source: pathMatch[1], symbols: ["*"] });
      }
    }
  }

  const funcRe = /^func\s+(\w+)/gm;
  while ((m = funcRe.exec(content)) !== null) {
    if (m[1][0] === m[1][0].toUpperCase()) {
      exports.push(m[1]);
    }
  }

  const typeRe = /^type\s+(\w+)/gm;
  while ((m = typeRe.exec(content)) !== null) {
    if (m[1][0] === m[1][0].toUpperCase()) {
      exports.push(m[1]);
    }
  }

  return { imports, exports };
}

export function buildProjectMap(nodes: ProjectNode[]): ProjectMap {
  const clusters = identifyClusters(nodes);
  const markdown = formatProjectMapMarkdown({ nodes, clusters, generatedAt: "", totalFiles: nodes.length, tokenEstimate: 0 });
  return {
    nodes,
    clusters,
    generatedAt: new Date().toISOString(),
    totalFiles: nodes.length,
    tokenEstimate: Math.ceil(markdown.length / 4),
  };
}

function identifyClusters(nodes: ProjectNode[]): DependencyCluster[] {
  const dirGroups = new Map<string, string[]>();
  for (const node of nodes) {
    const parts = node.relativePath.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!dirGroups.has(dir)) {
      dirGroups.set(dir, []);
    }
    dirGroups.get(dir)!.push(node.relativePath);
  }

  const clusters: DependencyCluster[] = [];
  for (const [dir, files] of dirGroups) {
    if (files.length >= 2) {
      clusters.push({ name: dir, files });
    }
  }
  clusters.sort((a, b) => b.files.length - a.files.length);
  return clusters.slice(0, 20);
}

export function formatProjectMapMarkdown(map: ProjectMap): string {
  const lines: string[] = [];
  lines.push("# Project Structure Map");
  lines.push("");
  lines.push(`_Generated by Claude Code ToolBox — ${map.totalFiles} files scanned._`);
  lines.push("");

  const importCounts = new Map<string, number>();
  for (const node of map.nodes) {
    for (const imp of node.imports) {
      const resolved = imp.source.startsWith(".")
        ? imp.source
        : imp.source;
      importCounts.set(resolved, (importCounts.get(resolved) || 0) + 1);
    }
  }

  const ranked = map.nodes
    .map((n) => ({
      path: n.relativePath,
      exportCount: n.exports.length,
      importedBy: countImportersOf(n.relativePath, map.nodes),
    }))
    .sort((a, b) => b.importedBy - a.importedBy)
    .slice(0, 30);

  lines.push("## Core modules (by import rank)");
  lines.push("");
  for (const r of ranked) {
    if (r.importedBy > 0 || r.exportCount > 0) {
      lines.push(`- \`${r.path}\` — imported by ${r.importedBy} files, exports ${r.exportCount} symbols`);
    }
  }
  lines.push("");

  if (map.clusters.length > 0) {
    lines.push("## Directory clusters");
    lines.push("");
    for (const c of map.clusters.slice(0, 15)) {
      lines.push(`- **${c.name}/** (${c.files.length} files)`);
    }
    lines.push("");
  }

  lines.push("## File → import graph (top 50)");
  lines.push("");
  const topNodes = map.nodes
    .filter((n) => n.imports.length > 0)
    .sort((a, b) => b.imports.length - a.imports.length)
    .slice(0, 50);
  for (const n of topNodes) {
    const deps = n.imports.map((i) => i.source).slice(0, 5).join(", ");
    const suffix = n.imports.length > 5 ? ` +${n.imports.length - 5} more` : "";
    lines.push(`- \`${n.relativePath}\` → [${deps}${suffix}]`);
  }
  lines.push("");

  lines.push("---");
  lines.push("_Use this map to navigate the codebase efficiently. Check here before reading files._");
  return lines.join("\n");
}

function countImportersOf(targetPath: string, nodes: ProjectNode[]): number {
  const baseName = targetPath.replace(/\.\w+$/, "");
  let count = 0;
  for (const node of nodes) {
    for (const imp of node.imports) {
      if (imp.source.includes(baseName) || imp.source.endsWith(targetPath)) {
        count++;
        break;
      }
    }
  }
  return count;
}
