// Static builder: a pre-bound machine running the ship-agent.

import { resolveTargetToken } from '../shared/credentials.js';
import type { TargetConfig } from '../shared/types.js';
import type { BuilderHandle, BuilderProvider, BuilderProviderStatus, ProviderLog } from './provider.js';

export class StaticBuilderProvider implements BuilderProvider {
  readonly kind = 'static';

  constructor(private readonly target: TargetConfig) {}

  async ensure(_log: ProviderLog): Promise<BuilderHandle> {
    const t = await resolveTargetToken(this.target, 'builder.static');
    return { url: t.url, token: t.token, ...(t.caFile ? { caFile: t.caFile } : {}) };
  }

  /** bound machines have no lifecycle to lease; the task runs directly */
  async runExclusive<T>(_log: ProviderLog, _taskBudgetMs: number, fn: (handle: BuilderHandle) => Promise<T>): Promise<T> {
    const t = await resolveTargetToken(this.target, 'builder.static');
    return fn({ url: t.url, token: t.token, ...(t.caFile ? { caFile: t.caFile } : {}) });
  }

  async release(): Promise<void> {
    // A bound machine is never destroyed by the controller.
  }

  async status(): Promise<BuilderProviderStatus> {
    return { kind: this.kind, active: true, url: this.target.url };
  }
}
