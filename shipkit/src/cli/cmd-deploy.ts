// `ship deploy` — trigger runtime agent to pull + compose up + healthcheck a given image ref.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { createEmitter } from './output.js';
import { minutesArg, runDeployPipeline } from './pipeline.js';

export async function cmdDeploy(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      json: { type: 'boolean' },
      ref: { type: 'string' },
      app: { type: 'string' },
      to: { type: 'string' },
      'env-file': { type: 'string' },
      'keep-env': { type: 'boolean' },
      'timeout-min': { type: 'string' },
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const result = await runDeployPipeline({
    config: loadConfig(args.values.config),
    cwd: process.cwd(),
    logger: em.log,
    app: args.values.app,
    imageRef: args.values.ref,
    envFile: args.values['env-file'],
    keepEnv: args.values['keep-env'],
    targetName: args.values.to,
    timeoutMs: minutesArg(args.values['timeout-min'], 15),
  });
  em.payload(result);
  if (!em.json) em.log.info('deploy complete', { app: result.app, imageRef: result.imageRef, target: result.target });
  return 0;
}
