// `ship builder up|down|status` — manage the builder machine (dynamic create/release or bound static).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { createBuilderProvider } from '../providers/registry.js';
import { createEmitter } from './output.js';

export async function cmdBuilder(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: { config: { type: 'string' }, json: { type: 'boolean' } },
    allowPositionals: true,
  });
  const em = createEmitter(args.values.json ?? false);
  const action = args.positionals[0] ?? 'status';
  if (!['up', 'down', 'status'].includes(action)) {
    throw new Error('usage: ship builder up|down|status');
  }
  const config = loadConfig(args.values.config);
  const provider = await createBuilderProvider(config);

  if (action === 'up') {
    const handle = await provider.ensure((m, meta) => em.log.info(m, meta));
    em.payload({ builder: { kind: provider.kind, url: handle.url, token: handle.token } });
    if (!em.json) em.log.info('builder ready', { url: handle.url });
    return 0;
  }

  if (action === 'down') {
    if (provider.kind === 'static') {
      em.log.warn('static builder is a bound machine — nothing to release');
      return 0;
    }
    await provider.release();
    em.payload({ released: true });
    if (!em.json) em.log.info('builder instance released');
    return 0;
  }

  const st = await provider.status();
  em.payload({ builder: st });
  if (!em.json) em.log.info('builder status', { kind: st.kind, active: st.active, url: st.url ?? '-', ...(st.detail ?? {}) });
  return 0;
}
