/**
 * Composition root for the Agent Dashboard feature.
 *
 * Lifecycle:
 *   - `start()` binds the hook server, installs the helper script + settings.json
 *     entries (dedup, atomic), scans `~/.claude/projects/` for recent sessions
 *     and attaches a watcher per file, then GC-runs the store.
 *   - `stop()` closes watchers, the server, and uninstalls hook entries.
 *
 * The controller is a singleton per extension host; the hub view calls into it
 * via `CloudeCodeToolBox.agentDashboard.*` commands.
 */
import * as os from "node:os";
import * as path from "node:path";
import {
  HookInstallerError,
  detectForeignHooks,
  hookStatus,
  installHook,
  rewritePortInScript,
  uninstallHook,
  type HookInstallerStatus,
} from "./hookInstaller";
import { startHookServer, type HookServerHandle } from "./hookServer";
import { findRecentlyActiveSessions } from "./projectsScanner";
import { SessionStore, type SessionCard, type StoreSnapshot } from "./sessionStore";
import { TranscriptWatcher } from "./transcriptWatcher";

export type DashboardConfig = {
  homeDir?: string;
  preferredPort: number;
  retainDoneCardsMs: number;
  includeInternalRuns: boolean;
  installSafetyGuard: boolean;
  safetyPatterns: string[];
};

export type DashboardState = {
  running: boolean;
  port: number | null;
  installerStatus: HookInstallerStatus | null;
  sessionsDiscovered: number;
  /** Commands in ~/.claude/settings.json that look like a foreign agent-dock / sibling install. */
  foreignHooks: string[];
  lastError?: string;
};

export class DashboardController {
  readonly store: SessionStore;
  private server?: HookServerHandle;
  private readonly watchers = new Map<string, TranscriptWatcher>();
  private rescanTimer?: NodeJS.Timeout;
  private running = false;
  private lastError?: string;

  constructor(private readonly config: DashboardConfig) {
    this.store = new SessionStore({
      retainDoneCardsMs: config.retainDoneCardsMs,
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentPort(): number | null {
    return this.server?.port ?? null;
  }

  updateConfig(patch: Partial<DashboardConfig>): void {
    Object.assign(this.config, patch);
  }

  onChange(listener: (snapshot: StoreSnapshot) => void): () => void {
    return this.store.onChange(listener);
  }

  async currentState(): Promise<DashboardState> {
    const home = this.config.homeDir ?? os.homedir();
    const installerStatus = await hookStatus(home).catch(() => null);
    const foreignHooks = await detectForeignHooks(home).catch(() => []);
    return {
      running: this.running,
      port: this.server?.port ?? null,
      installerStatus,
      sessionsDiscovered: this.watchers.size,
      foreignHooks,
      lastError: this.lastError,
    };
  }

  async start(): Promise<DashboardState> {
    if (this.running) return this.currentState();
    const home = this.config.homeDir ?? os.homedir();
    this.lastError = undefined;
    /* 1. Start the hook server. */
    this.server = await startHookServer({
      preferredPort: this.config.preferredPort,
      store: this.store,
    });
    /* 2. Install the helper scripts + settings.json entries. */
    try {
      await installHook({
        homeDir: home,
        port: this.server.port,
        installSafetyGuard: this.config.installSafetyGuard,
        safetyPatterns: this.config.safetyPatterns,
      });
      if (this.server.port !== this.config.preferredPort) {
        await rewritePortInScript(
          this.server.port,
          home,
          this.config.installSafetyGuard,
          this.config.safetyPatterns
        );
      }
    } catch (e) {
      if (this.server) {
        await this.server.close().catch(() => undefined);
        this.server = undefined;
      }
      const msg = e instanceof HookInstallerError ? e.message : e instanceof Error ? e.message : String(e);
      this.lastError = msg;
      throw e;
    }
    /* 3. Discover existing transcripts and start watchers. */
    await this.rescanTranscripts();
    this.rescanTimer = setInterval(() => void this.rescanTranscripts(), 15_000);
    this.rescanTimer.unref?.();
    this.store.startGc();
    this.running = true;
    return this.currentState();
  }

  async stop(): Promise<DashboardState> {
    const home = this.config.homeDir ?? os.homedir();
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = undefined;
    }
    for (const [sessionId, watcher] of this.watchers) {
      await watcher.dispose().catch(() => undefined);
      this.watchers.delete(sessionId);
    }
    if (this.server) {
      await this.server.close().catch(() => undefined);
      this.server = undefined;
    }
    try {
      await uninstallHook(home);
    } catch {
      /* non-fatal — we've already closed the server */
    }
    this.running = false;
    return this.currentState();
  }

  async dispose(): Promise<void> {
    await this.stop().catch(() => undefined);
    this.store.dispose();
  }

  private async rescanTranscripts(): Promise<void> {
    const home = this.config.homeDir ?? os.homedir();
    let sessions;
    try {
      sessions = await findRecentlyActiveSessions(home);
    } catch {
      return;
    }
    const seenThisRound = new Set<string>();
    for (const session of sessions) {
      seenThisRound.add(session.sessionId);
      if (this.watchers.has(session.sessionId)) continue;
      const watcher = new TranscriptWatcher({
        sessionId: session.sessionId,
        filePath: session.filePath,
        onPatch: (patch) => {
          /* Tag cwd from the folder name if we don't have one yet. */
          if (!patch.cwd) {
            const decoded = session.projectFolder.replace(/^-/, "/").replace(/-/g, path.sep);
            patch.cwd = decoded;
          }
          this.store.applyPatch(patch, "external");
        },
        skipInitialStatus: true,
      });
      this.watchers.set(session.sessionId, watcher);
      try {
        await watcher.start();
      } catch {
        /* ignore — keep polling on next rescan */
        await watcher.dispose().catch(() => undefined);
        this.watchers.delete(session.sessionId);
      }
    }
  }
}

export function summarizeCard(card: SessionCard): string {
  return `${card.teamName ?? card.title ?? card.sessionId} · ${card.status}`;
}
