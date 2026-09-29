// `ship gc` — preview (default, synchronous) or execute (persistent job, pollable) (F34 + RA10).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { api, fetchLogTail, waitForJob } from '../shared/http.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { resolveTarget } from './targets.js';

interface GcPreviewResponse {
  mode: 'preview';
  protectedRefs: string[];
  candidates: Array<{ imageRef: string; app: string; addedAt?: string }>;
}

interface GcExecuteResult {
  mode: 'execute';
  candidates: number;
  removed: string[];
  skippedProtected: string[];
  missing: string[];
  failed: Array<{ imageRef: string; error: string }>;
}

export async function cmdGc(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      to: { type: 'string' },
      execute: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const config = loadConfig(args.values.config);
  const { name, target } = resolveTarget(config, args.values.to);

  if (args.values.execute) {
    const started = await api<{ jobId: string }>(target.url, target.token, 'POST', '/api/gc', { dryRun: false }, 20_000);
    em.log.info('gc execute started', { target: name, jobId: started.jobId });
    const job = await waitForJob(target.url, target.token, started.jobId, { timeoutMs: 15 * 60_000 });
    if (job.status === 'failed') {
      const tail = await fetchLogTail(target.url, target.token, started.jobId, 30);
      if (tail) em.log.error(`gc log tail:\n${tail.trim()}`);
      throw new CliError(`gc failed: ${job.error ?? 'unknown error'}`, 4);
    }
    const r = job.result as GcExecuteResult;
    em.payload({ target: name, ...r });
    if (!em.json) {
      em.log.info('gc executed', {
        target: name, removed: r.removed.length, of: r.candidates,
        skippedProtected: r.skippedProtected.length, missing: r.missing.length, failed: r.failed.length,
      });
      for (const f of r.failed) em.log.error('  failed', f);
    }
    return r.failed.length > 0 ? 4 : 0;
  }

  const r = await api<GcPreviewResponse>(target.url, target.token, 'POST', '/api/gc', { dryRun: true });
  em.payload({ target: name, ...r });
  if (!em.json) {
    em.log.info('gc preview (no changes made — pass --execute to apply)', { target: name });
    for (const c of r.candidates) em.log.info(`  would remove ${c.imageRef}`, { app: c.app, addedAt: c.addedAt ?? '-' });
    em.log.info(`  protected (kept): ${r.protectedRefs.length} release snapshot refs`);
  }
  return 0;
}
