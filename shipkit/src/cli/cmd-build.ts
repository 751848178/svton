// `ship build` — trigger builder agent: build + push. v1 builds the single
// app; v2 groups build every selected service (default: all) into one
// per-service digest manifest recorded in local last-build state.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import { createEmitter } from './output.js';
import { minutesArg, runBuildPipeline } from './pipeline.js';
import { parseServicesArg, resolveSelection } from './service-selection.js';
import { runMultiBuildPipeline } from './pipeline-multi.js';

export async function cmdBuild(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      'from-dir': { type: 'string' },
      tag: { type: 'string' },
      'keep-builder': { type: 'boolean' },
      'timeout-min': { type: 'string' },
      services: { type: 'string' },
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const timeoutMs = minutesArg(args.values['timeout-min'], 60);
  const loaded = loadSpecAnyAt(process.cwd());

  if (loaded.version === 2) {
    const spec = loaded.spec;
    const selection = resolveSelection(spec, parseServicesArg(args.values.services));
    const out = await runMultiBuildPipeline({
      config: loadConfig(args.values.config),
      cwd: process.cwd(),
      logger: em.log,
      fromDir: args.values['from-dir'],
      keepBuilder: args.values['keep-builder'],
      spec,
      selection,
      timeoutMs,
    });
    em.payload({
      group: spec.name,
      services: Object.fromEntries(Object.entries(out.services).map(([n, s]) => [n, { imageRef: s.imageRef, tag: s.tag, digest: s.digest, sha: s.sha }])),
      builderUrl: out.builderUrl,
      builderRelease: out.builderRelease,
    });
    if (!em.json) em.log.info('group build complete', { group: spec.name, services: Object.keys(out.services) });
    return 0;
  }

  const out = await runBuildPipeline({
    config: loadConfig(args.values.config),
    cwd: process.cwd(),
    logger: em.log,
    fromDir: args.values['from-dir'],
    tag: args.values.tag,
    keepBuilder: args.values['keep-builder'],
    timeoutMs,
  });
  em.payload({
    app: out.spec.name,
    imageRef: out.push.imageRef,
    tag: out.build.tag,
    digest: out.push.digest,
    sha: out.build.sha,
    builderUrl: out.builderUrl,
  });
  if (!em.json) em.log.info('build complete', { imageRef: out.push.imageRef });
  return 0;
}
