/**
 * Loopback HTTP server that Claude Code hooks POST to. Binds explicitly to
 * 127.0.0.1 (never `localhost` — Windows IPv6-first resolution is a known
 * failure mode). On EADDRINUSE we fall back to an ephemeral port and let the
 * controller rewrite the helper script.
 */
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import type { HookEventPayload, SessionStore } from "./sessionStore";

export type HookServerOptions = {
  preferredPort: number;
  store: SessionStore;
  /** Called whenever a safety alert arrives via the SafetyAlert event. */
  onSafetyAlert?: (payload: HookEventPayload & { pattern?: string; match_value?: string }) => void;
};

export type HookServerHandle = {
  port: number;
  pid: number | null;
  close: () => Promise<void>;
};

const MAX_BODY_BYTES = 1_000_000;

export async function startHookServer(opts: HookServerOptions): Promise<HookServerHandle> {
  // deepcode ignore HttpToHttps: loopback-only IPC server bound exclusively to 127.0.0.1, never network-exposed
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, pid: process.pid }));
      return;
    }
    if (req.method !== "POST" || !req.url || !req.url.startsWith("/hook")) {
      res.writeHead(404);
      res.end();
      return;
    }
    let received = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      let body: unknown;
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        body = text ? JSON.parse(text) : {};
      } catch {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      const payload = body as HookEventPayload & { pattern?: string; match_value?: string };
      try {
        if (payload && payload.hook_event_name === "SafetyAlert" && payload.session_id) {
          opts.onSafetyAlert?.(payload);
          opts.store.recordSafetyAlert(payload.session_id, {
            id: `${Date.now()}-${payload.pattern ?? "alert"}`,
            pattern: payload.pattern ?? "risk",
            tool: payload.tool_name ?? "",
            target: payload.match_value,
            t: new Date().toISOString(),
            acknowledged: false,
          });
        } else if (payload && payload.hook_event_name) {
          opts.store.applyHookEvent(payload);
        }
      } catch {
        /* Never throw out of a hook response. */
      }
      res.writeHead(200);
      res.end("ok");
    });
    req.on("error", () => {
      try {
        res.writeHead(200);
      } catch {
        /* response may already be gone */
      }
      res.end();
    });
  });

  const tryBind = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const onErr = (e: NodeJS.ErrnoException) => {
        server.off("listening", onOk);
        reject(e);
      };
      const onOk = () => {
        server.off("error", onErr);
        const info = server.address() as AddressInfo | null;
        resolve(info?.port ?? port);
      };
      server.once("error", onErr);
      server.once("listening", onOk);
      server.listen({ host: "127.0.0.1", port });
    });

  let boundPort: number;
  try {
    boundPort = await tryBind(opts.preferredPort);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EADDRINUSE") {
      boundPort = await tryBind(0);
    } else {
      throw err;
    }
  }
  server.unref?.();
  return {
    port: boundPort,
    pid: process.pid,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        /* Unref in case of zero connections pending. */
        server.unref?.();
      }),
  };
}
