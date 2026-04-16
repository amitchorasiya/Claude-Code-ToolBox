/** Client for skills.sh search API (public). */

const DEFAULT_BASE = "https://skills.sh";

export type SkillsShItem = {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
};

export async function searchSkillsSh(
  query: string,
  options?: { limit?: number; baseUrl?: string }
): Promise<SkillsShItem[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const base = options?.baseUrl ?? DEFAULT_BASE;
  const url = new URL("/api/search", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`skills.sh HTTP ${res.status}: ${res.statusText}`);
  }
  const raw = (await res.json()) as { skills?: unknown[] };
  const rows = Array.isArray(raw.skills) ? raw.skills : [];
  const out: SkillsShItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const x = row as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id.trim() : "";
    const skillId = typeof x.skillId === "string" ? x.skillId.trim() : "";
    const name = typeof x.name === "string" ? x.name.trim() : "";
    const source = typeof x.source === "string" ? x.source.trim() : "";
    if (!id || !skillId || !source) {
      continue;
    }
    const installs = typeof x.installs === "number" ? x.installs : 0;
    out.push({ id, skillId, name, installs, source });
  }
  return out;
}
