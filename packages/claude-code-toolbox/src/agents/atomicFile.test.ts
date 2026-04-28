import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteText } from "./atomicFile";

describe("atomicWriteText", () => {
  it("writes a new file with exact content", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-"));
    const target = path.join(dir, "hello.txt");
    await atomicWriteText(target, "hello world");
    expect(await fs.readFile(target, "utf8")).toBe("hello world");
  });

  it("overwrites an existing file atomically (result has new content)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-ovw-"));
    const target = path.join(dir, "file.txt");
    await fs.writeFile(target, "original", "utf8");
    await atomicWriteText(target, "replacement");
    expect(await fs.readFile(target, "utf8")).toBe("replacement");
  });

  it("creates parent directories as needed", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-mkdir-"));
    const target = path.join(dir, "a", "b", "c", "deep.txt");
    await atomicWriteText(target, "deep content");
    expect(await fs.readFile(target, "utf8")).toBe("deep content");
  });

  it("supports optional mode on POSIX (no-op on Windows)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-mode-"));
    const target = path.join(dir, "exec.sh");
    await atomicWriteText(target, "#!/bin/sh\necho ok\n", 0o755);
    const stat = await fs.stat(target);
    /* On POSIX we expect the executable bit; on win32, chmod is essentially
     * ignored and we don't assert anything specific. */
    if (process.platform !== "win32") {
      expect((stat.mode & 0o111) !== 0).toBe(true);
    } else {
      expect(stat.isFile()).toBe(true);
    }
  });
});
