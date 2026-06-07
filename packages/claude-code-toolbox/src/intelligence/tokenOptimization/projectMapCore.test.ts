import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  parseImportsExports,
  buildProjectMap,
  formatProjectMapMarkdown,
} from "./projectMapCore";

describe("projectMapCore", () => {
  describe("detectLanguage", () => {
    it("detects typescript", () => {
      expect(detectLanguage("src/foo.ts")).toBe("typescript");
      expect(detectLanguage("bar.tsx")).toBe("typescript");
    });

    it("detects python", () => {
      expect(detectLanguage("main.py")).toBe("python");
    });

    it("detects go", () => {
      expect(detectLanguage("cmd/server.go")).toBe("go");
    });

    it("returns unknown for unsupported", () => {
      expect(detectLanguage("file.txt")).toBe("unknown");
    });
  });

  describe("parseImportsExports — typescript", () => {
    it("parses named imports", () => {
      const code = `import { foo, bar } from "./utils";`;
      const result = parseImportsExports(code, "typescript");
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe("./utils");
      expect(result.imports[0].symbols).toEqual(["foo", "bar"]);
    });

    it("parses default imports", () => {
      const code = `import React from "react";`;
      const result = parseImportsExports(code, "typescript");
      expect(result.imports[0].symbols).toEqual(["React"]);
    });

    it("parses exports", () => {
      const code = `export function activate() {}\nexport const CONST = 1;\nexport class MyClass {}`;
      const result = parseImportsExports(code, "typescript");
      expect(result.exports).toContain("activate");
      expect(result.exports).toContain("CONST");
      expect(result.exports).toContain("MyClass");
    });
  });

  describe("parseImportsExports — python", () => {
    it("parses from-import", () => {
      const code = `from os.path import join, dirname`;
      const result = parseImportsExports(code, "python");
      expect(result.imports[0].source).toBe("os.path");
      expect(result.imports[0].symbols).toEqual(["join", "dirname"]);
    });

    it("parses def and class exports", () => {
      const code = `def main():\n    pass\n\nclass Config:\n    pass`;
      const result = parseImportsExports(code, "python");
      expect(result.exports).toContain("main");
      expect(result.exports).toContain("Config");
    });
  });

  describe("buildProjectMap", () => {
    it("builds map from nodes", () => {
      const nodes = [
        {
          relativePath: "src/a.ts",
          language: "typescript",
          exports: ["foo"],
          imports: [{ source: "./b", symbols: ["bar"] }],
          lineCount: 10,
        },
        {
          relativePath: "src/b.ts",
          language: "typescript",
          exports: ["bar"],
          imports: [],
          lineCount: 5,
        },
      ];
      const map = buildProjectMap(nodes);
      expect(map.totalFiles).toBe(2);
      expect(map.clusters.length).toBeGreaterThan(0);
      expect(map.tokenEstimate).toBeGreaterThan(0);
    });
  });

  describe("formatProjectMapMarkdown", () => {
    it("produces readable markdown", () => {
      const nodes = [
        {
          relativePath: "src/index.ts",
          language: "typescript",
          exports: ["activate"],
          imports: [{ source: "./config", symbols: ["Config"] }],
          lineCount: 100,
        },
      ];
      const map = buildProjectMap(nodes);
      const md = formatProjectMapMarkdown(map);
      expect(md).toContain("# Project Structure Map");
      expect(md).toContain("src/index.ts");
    });
  });
});
