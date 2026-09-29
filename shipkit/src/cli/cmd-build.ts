// `ship build` — trigger builder agent: build + push, by default via git source of the cwd project.

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { createEmitter } from './output.js';
import { minutesArg, runBuildPipeline } from './pipeline.js';

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
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const out = await runBuildPipeline({
    config: loadConfig(args.values.config),
    cwd: process.cwd(),
    logger: em.log,
    fromDir: args.values['from-dir'],
    tag: args.values.tag,
    keepBuilder: args.values['keep-builder'],
    timeoutMs: minutesArg(args.values['timeout-min'], 60),
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
