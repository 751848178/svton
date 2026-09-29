// Short-lived HTTP server on the controller that serves the agent bundle + a pre-rendered
// install script to freshly created machines (no SSH, no external artifact hosting needed).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec } from '../shared/exec.js';

export interface BundleServer {
  /**
   * tokened base URL reachable from target machines, e.g. http://198.51.100.5:7411/<uuid>.
   * When publicBaseUrl is configured, URLs handed to machines use that https base instead
   * (TLS terminated by a reverse proxy in front of this local listener) — RA06.
   */
  base: string;
  port: number;
  /** per-role agent tokens — a leaked runtime token must not grant builder powers (F10) */
  tokens: { runtime: string; builder: string };
  installUrl(role: 'runtime' | 'builder'): string;
  stop(): Promise<void>;
}

export interface BundleOptions {
  distDir: string;
  bootstrapDir: string;
  /** controller IP/hostname reachable from the target machine */
  advertiseHost: string;
  port?: number;
  minutes?: number;
  agentToken?: string;
  /** https base URL of a TLS-terminated proxy in front of this listener (RA06) */
  publicBaseUrl?: string;
}

export async function startBundleServer(o: BundleOptions): Promise<BundleServer> {
  const token = randomUUID();
  const tokens = { runtime: randomUUID(), builder: o.agentToken ?? randomUUID() };
  const stage = await mkdtemp(path.join(tmpdir(), 'ship-bundle-'));
  const tgz = `${stage}.tgz`;

  // agent bundle = compiled dist + a minimal ESM package.json (no npm install needed on the machine)
  const cp = await exec('cp', ['-R', path.join(o.distDir, '.'), stage]);
  if (cp.code !== 0) throw new Error(`staging dist failed: ${cp.stderr}`);
  await writeFile(
    path.join(stage, 'package.json'),
    `${JSON.stringify({ name: 'shipkit-agent', version: '0.1.0', private: true, type: 'module' }, null, 2)}\n`,
  );
  const tar = await exec('tar', ['czf', tgz, '-C', stage, '.']);
  if (tar.code !== 0) throw new Error(`packing agent bundle failed: ${tar.stderr}`);
  const installTpl = await readFile(path.join(o.bootstrapDir, 'install.sh'), 'utf8');

  let address: AddressInfo | null = null;
  const publicBase = () => (o.publicBaseUrl ? `${o.publicBaseUrl.replace(/\/+$/, '')}/${token}` : `http://${o.advertiseHost}:${address?.port ?? o.port ?? 7411}/${token}`);
  const server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const u = new URL(req.url ?? '/', 'http://bundle');
      if (!u.pathname.startsWith(`/${token}/`)) {
        res.writeHead(404).end();
        return;
      }
      const file = u.pathname.slice(token.length + 2);
      if (file === 'install.sh') {
        const role = u.searchParams.get('role') === 'builder' ? 'builder' : 'runtime';
        const agentTok = u.searchParams.get('token') ?? tokens[role];
        const port = u.searchParams.get('port') ?? '7410';
        const bundleBase = publicBase();
        const script = installTpl
          .replaceAll('__ROLE__', role)
          .replaceAll('__AGENT_TOKEN__', agentTok)
          .replaceAll('__AGENT_PORT__', port)
          .replaceAll('__BUNDLE_BASE__', bundleBase);
        res.writeHead(200, { 'content-type': 'text/x-shellscript; charset=utf-8' });
        res.end(script);
        return;
      }
      if (file === 'agent.tgz') {
        const data = await readFile(tgz);
        res.writeHead(200, { 'content-type': 'application/gzip' });
        res.end(data);
        return;
      }
      res.writeHead(404).end();
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port ?? 7411, '0.0.0.0', () => resolve());
  });
  address = server.address() as AddressInfo;

  const timer = setTimeout(() => {
    void stop();
  }, (o.minutes ?? 30) * 60_000);
  timer.unref();

  async function stop(): Promise<void> {
    clearTimeout(timer);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(stage, { recursive: true, force: true });
    await rm(tgz, { force: true });
  }

  return {
    base: publicBase(),
    port: address.port,
    tokens,
    installUrl: (role: 'runtime' | 'builder') =>
      `${publicBase()}/install.sh?role=${role}&token=${tokens[role]}&port=${o.publicBaseUrl ? '7410' : String(address.port)}`,
    stop,
  };
}
