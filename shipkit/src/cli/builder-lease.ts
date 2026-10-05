// Builder machine lease shared by the v1 single-build pipeline and the v2
// multi-service pipeline (F12 finally-release, F20 keep-window, RA03 budget,
// RA04 exclusive lease). The release OUTCOME is reported separately from the
// task result: a failed release after a healthy build/deploy must surface as
// "pending cleanup", never as a silent success or a rollback trigger.

import type { ShipConfig } from '../shared/types.js';
import type { Logger } from '../shared/log.js';
import { createBuilderProvider } from '../providers/registry.js';
import { sweepExpiredBuilders } from '../providers/tencent-client.js';
import type { BuilderHandle, BuilderProvider, ProviderLog } from '../providers/provider.js';
import { armCancellation } from './signal-guard.js';

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
  /** test seam: inject a provider instead of the registry default */
  providerFactory?: () => Promise<BuilderProvider>;
}): Promise<{ value: T; release: BuilderReleaseOutcome }> {
  const providerLog: ProviderLog = (m, meta) => o.log.info(m, meta);
  await sweepExpiredBuilders(providerLog);
  const provider = o.providerFactory ? await o.providerFactory() : await createBuilderProvider(o.config);
  const reuseWindow = o.config.builder.dynamic?.keepMinutes ?? 0;
  const keep = o.keepBuilder || reuseWindow > 0;
  // R09: a dynamic machine is real money — user cancellation (SIGINT/SIGTERM)
  // releases it eagerly and BOUNDED, even when a keep-window was configured
  // (keep applies to normal completion, not to an aborted run). Static mode
  // owns nothing, so no guard is armed.
  const guard = o.config.builder.mode === 'dynamic'
    ? armCancellation({
      log: (m, meta) => o.log.warn(m, meta),
      onCancel: () => provider.release(),
    })
    : null;
  let value: T;
  try {
    value = provider.runExclusive
      ? await provider.runExclusive(providerLog, o.taskBudgetMs, o.run)
      : await o.run(await provider.ensure(providerLog, o.taskBudgetMs));
  } catch (e) {
    // guard stays armed through the final release so a signal in that window
    // still gets bounded cleanup; dispose only afterwards
    const release = await finishBuilderRelease(o.config, keep, provider, o.log).catch((re: unknown) => {
      guard?.dispose();
      throw re;
    });
    guard?.dispose();
    void release;
    throw e;
  }
  const release = await finishBuilderRelease(o.config, keep, provider, o.log);
  guard?.dispose();
  return { value, release };
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
