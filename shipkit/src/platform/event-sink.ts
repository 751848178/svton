import type { ExecutionEvent, ExecutionHooks } from './contracts.js';
import { redactText } from './project-context.js';
import { sanitizeExecutionEvent } from './execution-event-sanitizer.js';

/** Serializes sync pipeline diagnostics into awaited, redacted durable events. */
export class EventSink {
  private queue: Promise<void> = Promise.resolve();
  private failure: unknown;
  constructor(private readonly hooks: ExecutionHooks, private readonly secrets: string[]) {}
  addSecret(secret: string) { if (secret.length >= 3) this.secrets.push(secret); }
  emit(event: ExecutionEvent): Promise<void> {
    const redact = (v: unknown): unknown => {
      if (typeof v === 'string') return redactText(v, this.secrets);
      if (typeof v === 'number' || typeof v === 'boolean') {
        const literal = String(v), safe = redactText(literal, this.secrets); return literal === safe ? v : safe;
      }
      if (Array.isArray(v)) return v.map(redact);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([key, value]) => [key, redact(value)]));
      return v;
    };
    const safe = sanitizeExecutionEvent(event, { redactValue: redact });
    this.queue = this.queue.then(() => this.hooks.emit(safe));
    this.queue.catch((e: unknown) => { this.failure = e; });
    return this.queue;
  }
  enqueue(event: ExecutionEvent): void { void this.emit(event); }
  async flush(): Promise<void> { await this.queue; if (this.failure) throw this.failure; }
  async checkpoint(): Promise<void> {
    await this.flush();
    if (await this.hooks.isCancellationRequested()) {
      await this.emit({ type: 'cancel', status: 'cancelled', message: 'Cancelled at a safe local boundary before starting more remote work' });
      throw Object.assign(new Error('Cancelled at a safe boundary'), { cancelled: true });
    }
  }
}
