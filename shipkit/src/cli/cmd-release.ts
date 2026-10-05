// `ship release` — build + push + deploy in one shot. v1 single-app specs keep
// the exact original flow; v2 groups (schemaVersion: 2) add --services
// selection and read-only --plan (no builder, no pull, no state change).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import { createEmitter } from './output.js';
import { minutesArg, runBuildPipeline, runDeployPipeline } from './pipeline.js';
import { requireDeploymentProtocol } from './deployment-protocol.js';
import { requireGroupProtocol } from './deployment-protocol.js';
import { resolveTarget } from './targets.js';
import { resolveProjectId } from './project-id.js';
import { parseServicesArg, resolveSelection } from './service-selection.js';
import { buildReleasePlan, fetchGroupState } from './release-plan.js';
import { runMultiBuildPipeline } from './pipeline-multi.js';
import { runGroupDeployPipeline } from './pipeline-group-deploy.js';
import { CliError } from './errors.js';

export async function cmdRelease(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      'from-dir': { type: 'string' },
      tag: { type: 'string' },
      'keep-builder': { type: 'boolean' },
      to: { type: 'string' },
      'env-file': { type: 'string' },
      'keep-env': { type: 'boolean' },
      'timeout-min': { type: 'string' },
      services: { type: 'string' },
      plan: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const config = loadConfig(args.values.config);
  const timeoutMs = minutesArg(args.values['timeout-min'], 60);
  const target = resolveTarget(config, args.values.to);
  const loaded = loadSpecAnyAt(process.cwd());

  if (loaded.version === 1) {
    if (args.values.services !== undefined || args.values.plan) {
      throw new CliError('--services/--plan require a multi-service ship.yaml (schemaVersion: 2) — this project is a v1 single-app spec');
    }
    await requireDeploymentProtocol(target.target, `runtime.targets.${target.name}`, Boolean(args.values['keep-env'] && !args.values['env-file']));
    const build = await runBuildPipeline({
      config,
      cwd: process.cwd(),
      logger: em.log,
      fromDir: args.values['from-dir'],
      tag: args.values.tag,
      keepBuilder: args.values['keep-builder'],
      timeoutMs,
    });
    const deploy = await runDeployPipeline({
      config,
      cwd: process.cwd(),
      logger: em.log,
      imageRef: build.imageRef,
      project: build.project,
      envFile: args.values['env-file'],
      keepEnv: args.values['keep-env'],
      targetName: args.values.to,
      timeoutMs,
    });
    em.payload({ build: { app: build.spec.name, imageRef: build.imageRef, digest: build.push.digest, tag: build.build.tag }, deploy });
    if (!em.json) em.log.info('release complete', { app: deploy.app, target: deploy.target, imageRef: deploy.imageRef });
    return 0;
  }

  // ---- v2 multi-service release ----
  const spec = loaded.spec;
  const requested = parseServicesArg(args.values.services);
  const selection = resolveSelection(spec, requested);
  const project = await resolveProjectId(process.cwd(), config, args.values['from-dir']);
  // capability + identity checks BEFORE any builder exists (money boundary)
  await requireGroupProtocol(target.target, `runtime.targets.${target.name}`);
  const state = await fetchGroupState(target.target, `runtime.targets.${target.name}`, spec.name, project, target.name);
  const plan = buildReleasePlan({ spec, project, env: target.name, target: target.name, selection, requested: requested ?? null, state, keepEnv: Boolean(args.values['keep-env']) });
  if (args.values.plan) {
    em.payload({ ok: true, plan });
    if (!em.json) {
      em.log.info('release plan (read-only)', {
        group: plan.group,
        changing: plan.selection.resolved,
        inheriting: plan.selection.inherited,
        firstDeployment: plan.firstDeployment,
      });
    }
    return 0;
  }
  if (args.values['env-file']) throw new CliError('--env-file is v1-only; v2 services declare envFile per service in ship.yaml');

  const manifest = await runMultiBuildPipeline({
    config,
    cwd: process.cwd(),
    logger: em.log,
    fromDir: args.values['from-dir'],
    keepBuilder: args.values['keep-builder'],
    spec,
    selection,
    timeoutMs,
  });
  const deploy = await runGroupDeployPipeline({
    config,
    cwd: process.cwd(),
    logger: em.log,
    spec,
    project,
    manifest,
    keepEnv: args.values['keep-env'],
    targetName: args.values.to,
    timeoutMs,
  });
  em.payload({
    build: {
      group: spec.name,
      services: Object.fromEntries(Object.entries(manifest.services).map(([n, s]) => [n, { imageRef: s.imageRef, tag: s.tag, digest: s.digest, sha: s.sha }])),
      builderRelease: manifest.builderRelease,
    },
    deploy,
  });
  if (manifest.builderRelease.builderRelease === 'failed') {
    em.log.warn('build/deploy succeeded but the dynamic builder FAILED to release — run `ship builder down` to clean it up', {
      error: manifest.builderRelease.error,
    });
  }
  if (!em.json) em.log.info('release complete', { group: deploy.app, target: deploy.target, changed: deploy.changedServices, inherited: deploy.inheritedServices });
  return 0;
}
