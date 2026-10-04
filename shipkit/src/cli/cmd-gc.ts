// `ship gc` — preview (default, synchronous) or execute (persistent job, pollable) (F34 + RA10).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { api, fetchLogTail, waitForJob } from '../shared/http.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { resolveTarget } from './targets.js';
import { resolveTargetToken } from '../shared/credentials.js';

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

  const rt = await resolveTargetToken(target, `runtime.targets.${name}`);
  const ca = rt.caFile ? { caFile: rt.caFile } : {};
  if (args.values.execute) {
    const started = await api<{ jobId: string }>(rt.url, rt.token, 'POST', '/api/gc', { dryRun: false }, 20_000, ca);
    em.log.info('gc execute started', { target: name, jobId: started.jobId });
    const job = await waitForJob(rt.url, rt.token, started.jobId, { timeoutMs: 15 * 60_000, ...ca });
    if (job.status === 'failed') {
      const tail = await fetchLogTail(rt.url, rt.token, started.jobId, 30, ca);
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

  const r = await api<GcPreviewResponse>(rt.url, rt.token, 'POST', '/api/gc', { dryRun: true }, 20_000, ca);
  em.payload({ target: name, ...r });
  if (!em.json) {
    em.log.info('gc preview (no changes made — pass --execute to apply)', { target: name });
    for (const c of r.candidates) em.log.info(`  would remove ${c.imageRef}`, { app: c.app, addedAt: c.addedAt ?? '-' });
    em.log.info(`  protected (kept): ${r.protectedRefs.length} release snapshot refs`);
  }
  return 0;
}
