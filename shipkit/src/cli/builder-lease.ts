// Builder machine lease shared by the v1 single-build pipeline and the v2
// multi-service pipeline (F12 finally-release, F20 keep-window, RA03 budget,
// RA04 exclusive lease). The release OUTCOME is reported separately from the
// task result: a failed release after a healthy build/deploy must surface as
// "pending cleanup", never as a silent success or a rollback trigger.

import type { ShipConfig } from '../shared/types.js';
import type { Logger } from '../shared/log.js';
import { createBuilderProvider } from '../providers/registry.js';
import { sweepExpiredBuilders } from '../providers/tencent-client.js';
import type { BuilderHandle, ProviderLog } from '../providers/provider.js';

export type BuilderReleaseOutcome =
  | { builderRelease: 'static' }
  | { builderRelease: 'kept' }
  | { builderRelease: 'released' }
  | { builderRelease: 'failed'; error: string };

export type BuilderLeaseLog = Pick<Logger, 'info' | 'warn'>;

export async function withBuilderLease<T>(o: {
  config: ShipConfig;
  keepBuilder?: boolean;
  /** the FULL task budget every selected service must fit into (RA03) */
  taskBudgetMs: number;
  log: BuilderLeaseLog;
  run: (handle: BuilderHandle) => Promise<T>;
}): Promise<{ value: T; release: BuilderReleaseOutcome }> {
  const providerLog: ProviderLog = (m, meta) => o.log.info(m, meta);
  await sweepExpiredBuilders(providerLog);
  const provider = await createBuilderProvider(o.config);
  const reuseWindow = o.config.builder.dynamic?.keepMinutes ?? 0;
  const keep = o.keepBuilder || reuseWindow > 0;
  let value: T;
  try {
    value = provider.runExclusive
      ? await provider.runExclusive(providerLog, o.taskBudgetMs, o.run)
      : await o.run(await provider.ensure(providerLog, o.taskBudgetMs));
  } catch (e) {
    await finishBuilderRelease(o.config, keep, provider, o.log);
    throw e;
  }
  return { value, release: await finishBuilderRelease(o.config, keep, provider, o.log) };
}

async function finishBuilderRelease(
  config: ShipConfig,
  keep: boolean,
  provider: Awaited<ReturnType<typeof createBuilderProvider>>,
  log: BuilderLeaseLog,
): Promise<BuilderReleaseOutcome> {
  if (config.builder.mode !== 'dynamic') return { builderRelease: 'static' };
  if (keep) {
    log.info('dynamic builder kept for reuse — release it with `ship builder down`');
    return { builderRelease: 'kept' };
  }
  log.info('releasing dynamic builder');
  try {
    await provider.release();
    return { builderRelease: 'released' };
  } catch (e) {
    log.warn('builder release failed — run `ship builder down`', { error: String(e) });
    return { builderRelease: 'failed', error: String(e) };
  }
}
