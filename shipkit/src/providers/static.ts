// Static builder: a pre-bound machine running the ship-agent.

import type { TargetConfig } from '../shared/types.js';
import type { BuilderHandle, BuilderProvider, BuilderProviderStatus, ProviderLog } from './provider.js';

export class StaticBuilderProvider implements BuilderProvider {
  readonly kind = 'static';

  constructor(private readonly target: TargetConfig) {}

  async ensure(_log: ProviderLog): Promise<BuilderHandle> {
    return { url: this.target.url, token: this.target.token };
  }

  /** bound machines have no lifecycle to lease; the task runs directly */
  async runExclusive<T>(_log: ProviderLog, _taskBudgetMs: number, fn: (handle: BuilderHandle) => Promise<T>): Promise<T> {
    return fn({ url: this.target.url, token: this.target.token });
  }

  async release(): Promise<void> {
    // A bound machine is never destroyed by the controller.
  }

  async status(): Promise<BuilderProviderStatus> {
    return { kind: this.kind, active: true, url: this.target.url };
  }
}
