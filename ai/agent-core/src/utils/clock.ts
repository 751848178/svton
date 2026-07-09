/**
 * Time and ID generation abstractions.
 *
 * Production code reads the wall clock and generates random IDs via the
 * default singletons (`SYSTEM_CLOCK`, `RANDOM_ID_GENERATOR`). Tests inject
 * {@link FakeClock} and {@link SequentialIdGenerator} so timestamps and IDs
 * become deterministic — every run of a test produces the same events, message
 * order, and persisted shapes.
 *
 * Keep these interfaces tiny: only the operations the runtime/services
 * actually need. Anything that currently calls `Date.now()` or `Math.random()`
 * directly should instead take an `IClock` / `IIdGenerator` (optional ctor
 * param defaulting to the system singletons, so existing callers are
 * unaffected).
 */

/** Read-only access to wall-clock time. */
export interface IClock {
  /** Current epoch milliseconds. */
  now(): number;
}

/** Generates unique identifiers. */
export interface IIdGenerator {
  /**
   * Return a fresh unique id. The optional prefix is used by callers that want
   * namespaced ids (e.g. `nextId('session')` → `session_...`).
   */
  nextId(prefix?: string): string;
}

// ============================================================
// Production singletons (real wall clock + random ids)
// ============================================================

/** Default clock backed by `Date.now`. */
export const SYSTEM_CLOCK: IClock = { now: () => Date.now() };

/**
 * Default id generator using `Math.random`. Format mirrors what the codebase
 * already produced historically (`<prefix>_<timestamp>_<rand>`) so existing
 * consumers see no functional change.
 */
export const RANDOM_ID_GENERATOR: IIdGenerator = {
  nextId(prefix?: string): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
  },
};

// ============================================================
// Test doubles
// ============================================================

/**
 * Fake clock for tests. Starts at a fixed epoch and only advances when the
 * test calls {@link advance} or {@link set}. Deterministic across runs.
 */
export class FakeClock implements IClock {
  private current: number;
  constructor(initial = 1_700_000_000_000) {
    this.current = initial;
  }
  now(): number {
    return this.current;
  }
  /** Set the clock to an explicit timestamp. */
  set(ts: number): void {
    this.current = ts;
  }
  /** Advance the clock by `ms` milliseconds (default 1000). */
  advance(ms = 1000): void {
    this.current += ms;
  }
}

/**
 * Id generator that returns sequential, predictable ids: `id_1`, `id_2`, …
 * When a prefix is given, the counter is namespaced per prefix so
 * `nextId('session')` and `nextId('project')` maintain independent counters.
 */
export class SequentialIdGenerator implements IIdGenerator {
  private readonly counters = new Map<string, number>();
  nextId(prefix?: string): string {
    const key = prefix ?? '_';
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return prefix ? `${prefix}_${n}` : `id_${n}`;
  }
}
