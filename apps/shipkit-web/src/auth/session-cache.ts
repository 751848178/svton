import type { State } from 'swr';

export class SessionCache extends Map<string, State<unknown>> {
  private active = true;
  override set(key: string, value: State<unknown>) {
    if (this.active) super.set(key, value);
    return this;
  }
  retire() { this.active = false; this.clear(); }
}
