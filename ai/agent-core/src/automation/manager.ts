import type {
  AutomationDefinition,
  AutomationTrigger,
  AutomationRun,
} from './types';
import type { IAutomationScheduler } from './scheduler';
import type { IStorage } from '@svton/agent-platform';

const STORAGE_PREFIX = 'agent:automation:';
const RUNS_PREFIX = 'agent:automation_runs:';
const MAX_RUNS_PER_AUTOMATION = 20;

let automationCounter = 0;

/**
 * Manages automated / scheduled tasks.
 *
 * Supports three trigger types:
 *  - **cron**: standard 5-field cron expressions.
 *  - **interval**: fires every N minutes.
 *  - **event**: triggered externally via `runNow()` or platform events.
 *
 * Definitions are persisted to storage.  The next run is computed and
 * scheduled via the injected {@link IAutomationScheduler}.
 */
export class AutomationManager {
  private definitions = new Map<string, AutomationDefinition>();
  private cancelFns = new Map<string, () => void>();
  private onTrigger?: (automation: AutomationDefinition) => Promise<void>;

  constructor(
    private storage: IStorage,
    private scheduler: IAutomationScheduler,
  ) {}

  /**
   * Load persisted automation definitions from storage.
   */
  async init(): Promise<void> {
    try {
      const keys = await this.storage.list(STORAGE_PREFIX);
      for (const key of keys) {
        const def = await this.storage.get<AutomationDefinition>(key);
        if (def?.id) {
          this.definitions.set(def.id, def);
          // Update counter to avoid ID collisions
          const num = parseInt(def.id.split('_')[1], 10);
          if (!isNaN(num) && num > automationCounter) automationCounter = num;

          // Reschedule enabled automations
          if (def.enabled) {
            this.scheduleNext(def);
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Set the handler invoked when an automation triggers.
   */
  setTriggerHandler(handler: (automation: AutomationDefinition) => Promise<void>): void {
    this.onTrigger = handler;
  }

  /**
   * Create a new automation definition.
   */
  async create(
    def: Omit<AutomationDefinition, 'id' | 'createdAt' | 'enabled'> & { enabled?: boolean },
  ): Promise<AutomationDefinition> {
    const id = `auto_${++automationCounter}_${Date.now()}`;
    const now = Date.now();

    const automation: AutomationDefinition = {
      ...def,
      id,
      createdAt: now,
      enabled: def.enabled ?? true,
    };

    automation.nextRunAt = this.computeNextRun(automation.trigger);
    this.definitions.set(id, automation);
    await this.persist(automation);

    if (automation.enabled) {
      this.scheduleNext(automation);
    }

    return automation;
  }

  /**
   * Update an existing automation definition.
   */
  async update(id: string, patch: Partial<AutomationDefinition>): Promise<void> {
    const existing = this.definitions.get(id);
    if (!existing) return;

    const updated: AutomationDefinition = { ...existing, ...patch, id: existing.id };
    // Recompute next run if trigger changed
    if (patch.trigger) {
      updated.nextRunAt = this.computeNextRun(updated.trigger);
    }

    this.definitions.set(id, updated);
    await this.persist(updated);

    // Reschedule
    this.cancelSchedule(id);
    if (updated.enabled) {
      this.scheduleNext(updated);
    }
  }

  /**
   * Delete an automation definition.
   */
  async delete(id: string): Promise<void> {
    this.cancelSchedule(id);
    this.definitions.delete(id);
    try {
      await this.storage.delete(`${STORAGE_PREFIX}${id}`);
    } catch {
      // Non-fatal
    }
  }

  list(): AutomationDefinition[] {
    return Array.from(this.definitions.values());
  }

  get(id: string): AutomationDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  /**
   * Pause an automation (sets enabled=false).
   */
  async pause(id: string): Promise<void> {
    await this.update(id, { enabled: false });
  }

  /**
   * Resume a paused automation (sets enabled=true).
   */
  async resume(id: string): Promise<void> {
    await this.update(id, { enabled: true });
  }

  /**
   * Trigger an automation immediately, regardless of schedule.
   * Records the run result in execution history.
   */
  async runNow(id: string): Promise<void> {
    const automation = this.definitions.get(id);
    if (!automation || !this.onTrigger) return;

    const run: AutomationRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      automationId: id,
      startedAt: Date.now(),
      status: 'running',
      sessionId: '',
    };

    try {
      await this.onTrigger(automation);
      run.status = 'completed';
      run.finishedAt = Date.now();
    } catch (e) {
      run.status = 'failed';
      run.error = e instanceof Error ? e.message : String(e);
      run.finishedAt = Date.now();
    }

    // Record run in history
    await this.recordRun(run);

    // Update lastRunAt and reschedule
    automation.lastRunAt = Date.now();
    automation.nextRunAt = this.computeNextRun(automation.trigger);
    await this.persist(automation);

    this.cancelSchedule(id);
    if (automation.enabled) {
      this.scheduleNext(automation);
    }
  }

  /**
   * Trigger all automations matching an event type.
   * Called externally when a platform event occurs.
   */
  async triggerEvent(eventType: string, _data?: Record<string, unknown>): Promise<void> {
    const matching = Array.from(this.definitions.values()).filter(
      (a) => a.enabled && a.trigger.type === 'event' && a.trigger.eventType === eventType,
    );
    for (const automation of matching) {
      await this.runNow(automation.id);
    }
  }

  /**
   * Get execution history for an automation.
   */
  async getRuns(automationId: string): Promise<AutomationRun[]> {
    try {
      const runs = await this.storage.get<AutomationRun[]>(RUNS_PREFIX + automationId);
      return Array.isArray(runs) ? runs : [];
    } catch {
      return [];
    }
  }

  /**
   * Get recent runs across ALL automations (for inbox display).
   */
  async getRecentRuns(limit: number = 20): Promise<Array<AutomationRun & { automationName?: string }>> {
    const allRuns: Array<AutomationRun & { automationName?: string }> = [];
    for (const def of this.definitions.values()) {
      const runs = await this.getRuns(def.id);
      for (const run of runs) {
        allRuns.push({ ...run, automationName: def.name });
      }
    }
    return allRuns.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  }

  /**
   * Parse a natural language schedule into an AutomationTrigger.
   * Supports patterns like: "every day at 9am", "every 30 minutes", "hourly", "daily at 9:00"
   */
  static parseSchedule(schedule: string): AutomationTrigger {
    const s = schedule.toLowerCase().trim();

    // "every N minutes" / "every N hours"
    let m = s.match(/every\s+(\d+)\s*(min|minute|minutes|hour|hours)/);
    if (m) {
      const n = parseInt(m[1], 10);
      return m[2].startsWith('hour') ? { type: 'interval', minutes: n * 60 } : { type: 'interval', minutes: n };
    }

    // "hourly" / "every hour"
    if (s.includes('hourly') || s.match(/^every\s+hour/)) {
      return { type: 'interval', minutes: 60 };
    }

    // "every day at HH[:MM]" / "daily at HH[:MM]"
    m = s.match(/(?:every\s+day|daily)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (m) {
      let hour = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3] === 'pm' && hour < 12) hour += 12;
      if (m[3] === 'am' && hour === 12) hour = 0;
      return { type: 'cron', expression: `${min} ${hour} * * *` };
    }

    // "weekly on DAY at HH"
    m = s.match(/weekly\s+on\s+(\w+)\s+at\s+(\d{1,2})(?::(\d{2}))?/);
    if (m) {
      const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const day = dayMap[m[1].slice(0, 3).toLowerCase()] ?? 1;
      const hour = parseInt(m[2], 10);
      const min = m[3] ? parseInt(m[3], 10) : 0;
      return { type: 'cron', expression: `${min} ${hour} * * ${day}` };
    }

    // If it looks like a cron expression (5 space-separated fields with numbers/special chars)
    if (/^[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+$/.test(s)) {
      return { type: 'cron', expression: s };
    }

    // Default: treat as event trigger
    return { type: 'event', eventType: s.replace(/\s+/g, '_') };
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  /**
   * Compute the next run timestamp (epoch ms) for a trigger.
   *
   * - **interval**: Date.now() + minutes * 60000
   * - **cron**: parse the 5-field expression and find the next match.
   * - **event**: returns 0 (not scheduled — event-driven).
   */
  private computeNextRun(trigger: AutomationTrigger): number {
    switch (trigger.type) {
      case 'interval': {
        const minutes = trigger.minutes ?? 0;
        return Date.now() + minutes * 60_000;
      }
      case 'cron': {
        if (!trigger.expression) return 0;
        return this.computeCronNextRun(trigger.expression);
      }
      case 'event':
      default:
        return 0;
    }
  }

  /**
   * Simple 5-field cron parser: "minute hour day-of-month month day-of-week".
   * Supports: star, comma lists, ranges (1-5), step values (star/5 or 1-10/2).
   * Finds the next matching time after now (up to 1 year ahead).
   */
  private computeCronNextRun(expression: string): number {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return 0;

    const [
      minuteField,
      hourField,
      domField,
      monthField,
      dowField,
    ] = fields;

    const minutes = this.parseCronField(minuteField, 0, 59);
    const hours = this.parseCronField(hourField, 0, 23);
    const doms = this.parseCronField(domField, 1, 31);
    const months = this.parseCronField(monthField, 1, 12);
    const dows = this.parseCronField(dowField, 0, 6); // 0 = Sunday

    // Start from the next minute
    const now = new Date();
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes() + 1,
      0,
      0,
    );

    // Search up to 366 days ahead
    const maxTime = now.getTime() + 366 * 86_400_000;

    while (candidate.getTime() < maxTime) {
      const month = candidate.getMonth() + 1; // 1-12
      if (!months.has(month)) {
        candidate.setMonth(candidate.getMonth() + 1, 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }

      const dom = candidate.getDate();
      const dow = candidate.getDay(); // 0 = Sunday
      // In cron, if both dom and dow are restricted, either can match.
      // If one is unrestricted (*), the other must match.
      const domRestricted = domField !== '*';
      const dowRestricted = dowField !== '*';
      let dayMatches: boolean;
      if (domRestricted && dowRestricted) {
        dayMatches = doms.has(dom) || dows.has(dow);
      } else {
        dayMatches = doms.has(dom) && dows.has(dow);
      }
      if (!dayMatches) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }

      if (!hours.has(candidate.getHours())) {
        candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
        continue;
      }

      if (!minutes.has(candidate.getMinutes())) {
        candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
        continue;
      }

      return candidate.getTime();
    }

    return 0;
  }

  /**
   * Parse a single cron field into a Set of matching values.
   */
  private parseCronField(field: string, min: number, max: number): Set<number> {
    const result = new Set<number>();

    for (const part of field.split(',')) {
      const [rangePart, stepPart] = part.split('/');
      const step = stepPart ? parseInt(stepPart, 10) : 1;

      let lo: number;
      let hi: number;

      if (rangePart === '*') {
        lo = min;
        hi = max;
      } else if (rangePart.includes('-')) {
        const [a, b] = rangePart.split('-');
        lo = parseInt(a, 10);
        hi = parseInt(b, 10);
      } else {
        lo = parseInt(rangePart, 10);
        hi = stepPart ? max : lo; // Single value, or */N handled above
      }

      for (let v = lo; v <= hi; v += step) {
        if (v >= min && v <= max) {
          result.add(v);
        }
      }
    }

    return result;
  }

  private scheduleNext(automation: AutomationDefinition): void {
    if (!automation.enabled) return;
    if (!automation.nextRunAt || automation.nextRunAt === 0) return; // event-driven or no schedule

    const handler = async () => {
      if (!this.onTrigger) return;
      try {
        await this.onTrigger(automation);
      } catch {
        // Swallow — trigger handler errors are non-fatal
      }

      // Update last run and reschedule
      automation.lastRunAt = Date.now();
      automation.nextRunAt = this.computeNextRun(automation.trigger);
      await this.persist(automation);

      // Schedule the next run
      this.scheduleNext(automation);
    };

    const cancel = this.scheduler.schedule(automation.nextRunAt, handler);
    this.cancelFns.set(automation.id, cancel);
  }

  private cancelSchedule(id: string): void {
    const cancel = this.cancelFns.get(id);
    if (cancel) {
      cancel();
      this.cancelFns.delete(id);
    }
  }

  private async persist(automation: AutomationDefinition): Promise<void> {
    try {
      await this.storage.set(`${STORAGE_PREFIX}${automation.id}`, automation);
    } catch {
      // Non-fatal
    }
  }

  private async recordRun(run: AutomationRun): Promise<void> {
    try {
      const key = RUNS_PREFIX + run.automationId;
      const existing = await this.storage.get<AutomationRun[]>(key) ?? [];
      existing.unshift(run);
      // Trim to max history size
      if (existing.length > MAX_RUNS_PER_AUTOMATION) {
        existing.length = MAX_RUNS_PER_AUTOMATION;
      }
      await this.storage.set(key, existing);
    } catch {
      // Non-fatal
    }
  }
}
