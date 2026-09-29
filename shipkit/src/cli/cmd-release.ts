// `ship release` — build + push + deploy in one shot.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { createEmitter } from './output.js';
import { minutesArg, runBuildPipeline, runDeployPipeline } from './pipeline.js';

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
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const config = loadConfig(args.values.config);
  const timeoutMs = minutesArg(args.values['timeout-min'], 60);

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
    envFile: args.values['env-file'],
    keepEnv: args.values['keep-env'],
    targetName: args.values.to,
    timeoutMs,
  });
  em.payload({ build: { app: build.spec.name, imageRef: build.imageRef, digest: build.push.digest, tag: build.build.tag }, deploy });
  if (!em.json) em.log.info('release complete', { app: deploy.app, target: deploy.target, imageRef: deploy.imageRef });
  return 0;
}
