/** Client for the public Model Context Protocol registry (read-only search). */

const REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0/servers";

export type RegistrySearchMetadata = {
  nextCursor?: string;
  count?: number;
};

export type RegistrySearchResult = {
  servers: unknown[];
  metadata: RegistrySearchMetadata;
};

export async function searchMcpRegistry(params: {
  search: string;
  limit?: number;
  cursor?: string;
}): Promise<RegistrySearchResult> {
  const q = params.search.trim();
  if (!q) {
    return { servers: [], metadata: {} };
  }
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
  const url = new URL(REGISTRY_BASE);
  url.searchParams.set("version", "latest");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("search", q);
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Registry HTTP ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as {
    servers?: unknown[];
    metadata?: { nextCursor?: string; next_cursor?: string; count?: number };
  };
  const servers = Array.isArray(data.servers) ? data.servers : [];
  const meta = data.metadata ?? {};
  return {
    servers,
    metadata: {
      nextCursor: meta.nextCursor ?? meta.next_cursor,
      count: typeof meta.count === "number" ? meta.count : undefined,
    },
  };
}
