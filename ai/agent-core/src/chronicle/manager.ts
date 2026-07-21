import type { ScreenCapture, ChronicleConfig } from './types';
import type { IStorage, IPlatform } from '@svton/agent-platform';
import { buildChronicleMemoryText } from './chronicle-memory-text.utils';
import {
  searchScreenCaptures,
  sortNewestFirst,
} from './chronicle-search.utils';
import {
  cloneChronicleConfig,
  cloneScreenCapture,
  cloneScreenCaptures,
} from './chronicle-snapshot.utils';

const STORAGE_PREFIX = 'agent:chronicle:';
const CONFIG_KEY = `${STORAGE_PREFIX}config`;
const CAPTURES_KEY = `${STORAGE_PREFIX}captures`;

const DEFAULT_CONFIG: ChronicleConfig = {
  intervalSeconds: 30,
  enabled: false,
  retentionDays: 7,
};

export class ChronicleManager {
  private captures: ScreenCapture[] = [];
  private config: ChronicleConfig = { ...DEFAULT_CONFIG };
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private storage: IStorage,
    private platform: IPlatform,
  ) {}

  async init(): Promise<void> {
    try {
      const storedConfig = await this.storage.get<ChronicleConfig>(CONFIG_KEY);
      if (storedConfig) {
        this.config = cloneChronicleConfig({
          ...DEFAULT_CONFIG,
          ...storedConfig,
        });
      }
    } catch {
      // Non-fatal — use defaults
    }

    try {
      const storedCaptures = await this.storage.get<ScreenCapture[]>(CAPTURES_KEY);
      if (storedCaptures && Array.isArray(storedCaptures)) {
        this.captures = cloneScreenCaptures(storedCaptures);
      }
    } catch {
      // Non-fatal — start with empty captures
    }
  }

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

  async stop(): Promise<void> {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  async pause(durationMinutes: number): Promise<void> {
    this.config.pausedUntil = Date.now() + durationMinutes * 60_000;
    await this.persistConfig();
    await this.stop();
  }

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
    return cloneChronicleConfig(this.config);
  }

  async updateConfig(patch: Partial<ChronicleConfig>): Promise<void> {
    const wasRunning = this.isRunning();
    this.config = cloneChronicleConfig({ ...this.config, ...patch });

    await this.persistConfig();

    // Restart timer if interval changed while running
    if (wasRunning) {
      await this.stop();
    }
    if (this.config.enabled && !this.isPaused()) {
      await this.start();
    }
  }

  async addCapture(capture: ScreenCapture): Promise<void> {
    this.captures.push(cloneScreenCapture(capture));

    // Enforce retention — remove captures older than retentionDays
    await this.clearOlderThan(this.config.retentionDays);

    await this.persistCaptures();
  }

  async search(
    query: string,
    opts?: { from?: number; to?: number; limit?: number },
  ): Promise<ScreenCapture[]> {
    return cloneScreenCaptures(searchScreenCaptures(this.captures, query, opts));
  }

  async getRecent(limit: number): Promise<ScreenCapture[]> {
    return cloneScreenCaptures(sortNewestFirst(this.captures).slice(0, limit));
  }

  async buildMemoryText(): Promise<string> {
    const recent = await this.getRecent(10);
    return buildChronicleMemoryText(recent);
  }

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

  private isPaused(): boolean {
    return (
      this.config.pausedUntil !== undefined &&
      this.config.pausedUntil > Date.now()
    );
  }

  private async persistConfig(): Promise<void> {
    try {
      await this.storage.set(CONFIG_KEY, cloneChronicleConfig(this.config));
    } catch {
      // Non-fatal
    }
  }

  private async persistCaptures(): Promise<void> {
    try {
      await this.storage.set(CAPTURES_KEY, cloneScreenCaptures(this.captures));
    } catch {
      // Non-fatal
    }
  }
}
