import type { PublicRuntimeEvent } from './types';

/**
 * FIFO rendezvous between awaited Pi subscriptions/capability callbacks and
 * the runtime async generator. Native Pi event objects are enqueued unchanged.
 */
export class RuntimeEventMultiplexer {
  private readonly queue: PublicRuntimeEvent[] = [];
  private waiter: (() => void) | null = null;
  private closed = false;

  push(event: PublicRuntimeEvent): void {
    if (this.closed) return;
    this.queue.push(event);
    this.wake();
  }

  async next(): Promise<PublicRuntimeEvent | null> {
    while (true) {
      const event = this.queue.shift();
      if (event) return event;
      if (this.closed) return null;
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  close(): void {
    this.closed = true;
    this.wake();
  }

  private wake(): void {
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.();
  }
}
