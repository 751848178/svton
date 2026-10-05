// `ship rollback <app|group>` — re-activate the previous release snapshot
// (image + env + config) (F02). v2 groups roll back the last release's
// changedServices, or an explicit --services set found in history.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import { api, waitForJob } from '../shared/http.js';
import { resolveProjectId } from './project-id.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { resolveTarget } from './targets.js';
import { requireDeploymentProtocol, requireGroupProtocol } from './deployment-protocol.js';
import { runGroupRollbackCli } from './pipeline-group-deploy.js';
import { parseServicesArg } from './service-selection.js';

export async function cmdRollback(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      to: { type: 'string' },
      'from-dir': { type: 'string' },
      services: { type: 'string' },
    },
    allowPositionals: true,
  });
  const em = createEmitter(args.values.json ?? false);
  const app = args.positionals[0];
  if (!app) throw new CliError('usage: ship rollback <app|group> [--to target] [--services a,b]');

  const config = loadConfig(args.values.config);
  const { name, target } = resolveTarget(config, args.values.to);
  const loaded = loadSpecAnyAt(process.cwd());

  if (loaded.version === 2 && loaded.spec.name === app) {
    // v2 group rollback (only for the group this repo declares)
    const services = parseServicesArg(args.values.services);
    const project = await resolveProjectId(process.cwd(), config, args.values['from-dir']);
    const result = await runGroupRollbackCli({
      config, app, project, services, targetName: args.values.to,
    });
    em.payload({ ...result, target: name });
    if (!em.json) em.log.info('group rollback complete', { group: result.app, changed: result.changedServices, releaseId: result.releaseId, target: name });
    return 0;
  }
  if (args.values.services !== undefined) throw new CliError('--services rollback applies to multi-service groups (schemaVersion: 2 ship.yaml with this group name)');

  const rt = await requireDeploymentProtocol(target, `runtime.targets.${name}`);
  const ca = rt.caFile ? { caFile: rt.caFile } : {};
  const started = await api<{ jobId: string }>(rt.url, rt.token, 'POST', '/api/rollback', { app, project: await resolveProjectId(process.cwd(), config, args.values['from-dir']), env: name }, 20_000, ca);
  em.log.info('rollback started', { app, target: name, jobId: started.jobId });
  const job = await waitForJob(rt.url, rt.token, started.jobId, { timeoutMs: 10 * 60_000, ...ca });
  if (job.status === 'failed') {
    const recovery = (job.result as { recovery?: { succeeded: boolean } } | undefined)?.recovery;
    throw new CliError(`rollback failed: ${job.error}`, recovery && !recovery.succeeded ? 6 : 4);
  }
  const result = job.result as { app: string; imageRef: string; releaseId: string };
  em.payload({ ...result, target: name });
  if (!em.json) em.log.info('rollback complete', { app: result.app, imageRef: result.imageRef, releaseId: result.releaseId, target: name });
  return 0;
}
