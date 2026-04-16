import { describe, expect, it } from "vitest";
import { buildContextPackMarkdown, truncateText } from "./contextPackCore";

describe("truncateText", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateText("hi", 10)).toBe("hi");
  });
  it("truncates long strings (prefix capped; notice may extend total length)", () => {
    const s = "a".repeat(20);
    const t = truncateText(s, 5);
    expect(t.startsWith("aaaaa")).toBe(true);
    expect(t).toContain("truncated");
    expect(t).toContain("15 more characters");
  });
});

describe("buildContextPackMarkdown", () => {
  it("includes workspace and file refs", () => {
    const md = buildContextPackMarkdown({
      notice: "> Notice\n\n",
      workspaceFolderName: "proj",
      workspaceRootPath: "/tmp/proj",
      activeFile: {
        relativePath: "src/a.ts",
        languageId: "typescript",
        selection: "const x = 1",
      },
      openEditorRelativePaths: ["src/a.ts", "README.md"],
      limits: { maxOpenEditors: 10, maxSelectionChars: 100 },
    });
    expect(md).toContain("proj");
    expect(md).toContain("#file:src/a.ts");
    expect(md).toContain("const x = 1");
  });
});
