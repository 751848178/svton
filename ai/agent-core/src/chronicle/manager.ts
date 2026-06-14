import type { ScreenCapture, ChronicleConfig } from './types';
import type { IStorage, IPlatform } from '@svton/agent-platform';

const STORAGE_PREFIX = 'agent:chronicle:';
const CONFIG_KEY = `${STORAGE_PREFIX}config`;
const CAPTURES_KEY = `${STORAGE_PREFIX}captures`;

const DEFAULT_CONFIG: ChronicleConfig = {
  intervalSeconds: 30,
  enabled: false,
  retentionDays: 7,
};

/**
 * Chronicle screen memory manager.
 *
 * The manager keeps a chronological log of screen captures that can be
 * searched and summarised for agent context.  The actual screen capture
 * is platform-dependent — a native backend (e.g. the Tauri Rust process)
 * captures screenshots and pushes them here via `addCapture`.
 */
export class ChronicleManager {
  private captures: ScreenCapture[] = [];
  private config: ChronicleConfig = { ...DEFAULT_CONFIG };
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private storage: IStorage,
    private platform: IPlatform,
  ) {}

  /**
   * Load config and captures from storage.
   */
  async init(): Promise<void> {
    try {
      const storedConfig = await this.storage.get<ChronicleConfig>(CONFIG_KEY);
      if (storedConfig) {
        this.config = { ...DEFAULT_CONFIG, ...storedConfig };
      }
    } catch {
      // Non-fatal — use defaults
    }

    try {
      const storedCaptures = await this.storage.get<ScreenCapture[]>(CAPTURES_KEY);
      if (storedCaptures && Array.isArray(storedCaptures)) {
        this.captures = storedCaptures;
      }
    } catch {
      // Non-fatal — start with empty captures
    }
  }

  /**
   * Start the interval timer that triggers periodic captures.
   */
  async start(): Promise<void> {
    if (this.timerId !== null) return;
    if (!this.config.enabled) return;
    if (this.isPaused()) return;

    const intervalMs = Math.max(1, this.config.intervalSeconds) * 1000;
    this.timerId = setInterval(() => {
      // The actual capture is platform-driven; this timer is a heartbeat
      // that can be used to signal the native backend.  We emit nothing here.
      // The native backend pushes captures via addCapture().
    }, intervalMs);
  }

  /**
   * Stop the interval timer.
   */
  async stop(): Promise<void> {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Pause capture for the given duration.
   */
  async pause(durationMinutes: number): Promise<void> {
    this.config.pausedUntil = Date.now() + durationMinutes * 60_000;
    await this.persistConfig();
    await this.stop();
  }

  /**
   * Resume capture after a pause.
   */
  async resume(): Promise<void> {
    this.config.pausedUntil = undefined;
    await this.persistConfig();
    if (this.config.enabled) {
      await this.start();
    }
  }

  isRunning(): boolean {
    return this.timerId !== null && !this.isPaused();
  }

  getConfig(): ChronicleConfig {
    return { ...this.config };
  }

  async updateConfig(patch: Partial<ChronicleConfig>): Promise<void> {
    const wasRunning = this.isRunning();
    this.config = { ...this.config, ...patch };

    await this.persistConfig();

    // Restart timer if interval changed while running
    if (wasRunning) {
      await this.stop();
    }
    if (this.config.enabled && !this.isPaused()) {
      await this.start();
    }
  }

  /**
   * Called by the platform / native backend when a new capture is available.
   */
  async addCapture(capture: ScreenCapture): Promise<void> {
    this.captures.push(capture);

    // Enforce retention — remove captures older than retentionDays
    await this.clearOlderThan(this.config.retentionDays);

    await this.persistCaptures();
  }

  /**
   * Search captures by text query across OCR text, summary, app context, and window title.
   */
  async search(
    query: string,
    opts?: { from?: number; to?: number; limit?: number },
  ): Promise<ScreenCapture[]> {
    const q = query.toLowerCase();
    let results = this.captures.filter((c) => {
      const text = [c.ocrText, c.summary, c.appContext, c.windowTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });

    if (opts?.from !== undefined) {
      results = results.filter((c) => c.capturedAt >= opts.from!);
    }
    if (opts?.to !== undefined) {
      results = results.filter((c) => c.capturedAt <= opts.to!);
    }

    // Sort newest first
    results.sort((a, b) => b.capturedAt - a.capturedAt);

    if (opts?.limit !== undefined) {
      results = results.slice(0, opts.limit);
    }

    return results;
  }

  /**
   * Get the most recent captures.
   */
  async getRecent(limit: number): Promise<ScreenCapture[]> {
    const sorted = [...this.captures].sort((a, b) => b.capturedAt - a.capturedAt);
    return sorted.slice(0, limit);
  }

  /**
   * Build a compact text summary of recent captures for agent context injection.
   */
  async buildMemoryText(): Promise<string> {
    const recent = await this.getRecent(10);
    if (recent.length === 0) return '';

    const lines: string[] = ['## Recent Screen Activity'];

    for (const c of recent) {
      const time = new Date(c.capturedAt).toLocaleString();
      const parts: string[] = [`[${time}]`];
      if (c.windowTitle) parts.push(`"${c.windowTitle}"`);
      if (c.appContext) parts.push(`(${c.appContext})`);
      if (c.summary) parts.push(`— ${c.summary}`);
      lines.push(`- ${parts.join(' ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Remove captures older than the given number of days.
   * Returns the number of captures deleted.
   */
  async clearOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 86_400_000;
    const before = this.captures.length;
    this.captures = this.captures.filter((c) => c.capturedAt >= cutoff);
    const removed = before - this.captures.length;
    if (removed > 0) {
      await this.persistCaptures();
    }
    return removed;
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private isPaused(): boolean {
    return (
      this.config.pausedUntil !== undefined &&
      this.config.pausedUntil > Date.now()
    );
  }

  private async persistConfig(): Promise<void> {
    try {
      await this.storage.set(CONFIG_KEY, this.config);
    } catch {
      // Non-fatal
    }
  }

  private async persistCaptures(): Promise<void> {
    try {
      await this.storage.set(CAPTURES_KEY, this.captures);
    } catch {
      // Non-fatal
    }
  }
}
