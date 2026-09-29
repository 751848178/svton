// `ship serve-bundle` — serve the agent installer for manual bootstrap of bound machines.
// Runtime and builder get DIFFERENT tokens (F10).

import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startBundleServer } from '../providers/bundle-server.js';
import { resolveShipkitRoot } from '../providers/registry.js';
import { createEmitter } from './output.js';

export async function cmdServeBundle(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: {
      json: { type: 'boolean' },
      host: { type: 'string' },
      port: { type: 'string' },
      minutes: { type: 'string' },
    },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const host = args.values.host;
  if (!host) throw new Error('--host <controller-ip> is required (must be reachable from target machines)');
  const root = resolveShipkitRoot();
  if (!existsSync(path.join(root, 'dist', 'agent', 'server.js'))) {
    throw new Error(`agent bundle missing — run \`pnpm --filter shipkit build\` first (expected ${path.join(root, 'dist', 'agent', 'server.js')})`);
  }
  const port = Number(args.values.port);
  const minutes = args.values.minutes ? Number(args.values.minutes) : 45;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) throw new Error('--minutes must be 1-1440');

  const server = await startBundleServer({
    distDir: path.join(root, 'dist'),
    bootstrapDir: path.join(root, 'bootstrap'),
    advertiseHost: host,
    port: Number.isFinite(port) ? port : undefined,
    minutes,
  });

  const runtimeInstall = server.installUrl('runtime');
  const builderInstall = server.installUrl('builder');
  em.payload({ baseUrl: server.base, port: server.port, runtimeToken: server.tokens.runtime, builderToken: server.tokens.builder, minutes, runtimeInstall, builderInstall });
  if (!em.json) {
    process.stderr.write(`bundle server listening: ${server.base}  (auto-stops in ${minutes} min)\n\n`);
    process.stderr.write(`runtime machine (run on that machine as root):\n  curl -fsSL '${runtimeInstall}' | bash\n\n`);
    process.stderr.write(`builder machine (run on that machine as root):\n  curl -fsSL '${builderInstall}' | bash\n\n`);
    process.stderr.write(`ship.config.yaml tokens → runtime target token: ${server.tokens.runtime} | static builder token: ${server.tokens.builder}\n`);
  }

  process.on('SIGINT', () => {
    void server.stop().then(() => process.exit(0));
  });
  await new Promise((r) => setTimeout(r, minutes * 60_000));
  await server.stop();
  return 0;
}
