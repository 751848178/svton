const DEFAULT_LIMIT = 512;

/** Bounded recent-settlement registry used for duplicate suppression. */
export class UserInputSettledKeys {
  private readonly keys = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly limit = DEFAULT_LIMIT) {}

  has(key: string): boolean {
    return this.keys.has(key);
  }

  add(key: string): void {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.order.push(key);
    while (this.order.length > this.limit) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.keys.delete(oldest);
    }
  }

  clear(): void {
    this.keys.clear();
    this.order.length = 0;
  }

  get size(): number {
    return this.keys.size;
  }
}
