// `ship rollback <app>` — re-activate the previous release snapshot (image + env + config) (F02).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { api, waitForJob } from '../shared/http.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { resolveTarget } from './targets.js';

export async function cmdRollback(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      to: { type: 'string' },
    },
    allowPositionals: true,
  });
  const em = createEmitter(args.values.json ?? false);
  const app = args.positionals[0];
  if (!app) throw new CliError('usage: ship rollback <app> [--to target]');

  const config = loadConfig(args.values.config);
  const { name, target } = resolveTarget(config, args.values.to);
  const started = await api<{ jobId: string }>(target.url, target.token, 'POST', '/api/rollback', { app });
  em.log.info('rollback started', { app, target: name, jobId: started.jobId });
  const job = await waitForJob(target.url, target.token, started.jobId, { timeoutMs: 10 * 60_000 });
  if (job.status === 'failed') {
    const recovery = (job.result as { recovery?: { succeeded: boolean } } | undefined)?.recovery;
    throw new CliError(`rollback failed: ${job.error}`, recovery && !recovery.succeeded ? 6 : 4);
  }
  const result = job.result as { app: string; imageRef: string; releaseId: string };
  em.payload({ ...result, target: name });
  if (!em.json) em.log.info('rollback complete', { app: result.app, imageRef: result.imageRef, releaseId: result.releaseId, target: name });
  return 0;
}
