// Agent HTTP server: auth, role gating, body parsing, JSON error envelopes, lifecycle.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SpecError } from '../shared/spec-schema.js';
import { createLogger } from '../shared/log.js';
import type { AgentRole } from '../shared/types.js';
import { readJson } from './body.js';
import { dockerAvailable } from './docker.js';
import { HttpFail } from './http-fail.js';
import { JobStore } from './jobs.js';
import { buildRoutes, type RouteCtx } from './routes.js';
import { ReleaseStore } from './release.js';

export interface AgentHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export interface AgentOptions {
  role?: string;
  token?: string;
  port?: number;
  host?: string;
  workRoot?: string;
}

const ROLES: AgentRole[] = ['builder', 'runtime', 'both'];

export async function startAgent(opts: AgentOptions = {}): Promise<AgentHandle> {
  const log = createLogger(false);
  const roleRaw = opts.role ?? process.env.SHIP_AGENT_ROLE ?? 'both';
  if (!ROLES.includes(roleRaw as AgentRole)) throw new Error(`SHIP_AGENT_ROLE must be one of ${ROLES.join('|')}, got '${roleRaw}'`);
  const role = roleRaw as AgentRole;
  const token = opts.token ?? process.env.SHIP_AGENT_TOKEN ?? '';
  const port = opts.port ?? Number(process.env.SHIP_AGENT_PORT ?? 7410);
  const host = opts.host ?? process.env.SHIP_AGENT_HOST ?? '0.0.0.0';
  const workRoot = opts.workRoot ?? process.env.SHIP_WORK_ROOT ?? '/opt/shipkit-data';
  if (!token) throw new Error('SHIP_AGENT_TOKEN is required — the agent refuses to start unauthenticated');

  await mkdir(workRoot, { recursive: true });
  const jobs = new JobStore(workRoot);
  await jobs.loadPersisted();
  const releases = new ReleaseStore(path.join(workRoot, 'apps'));
  // docker probe cache with TTL: recovers automatically after docker comes back (F26)
  let dockerCache: { at: number; ok: boolean } | null = null;
  const dockerOk = async (): Promise<boolean> => {
    if (!dockerCache || Date.now() - dockerCache.at > 60_000) {
      dockerCache = { at: Date.now(), ok: await dockerAvailable() };
    }
    return dockerCache.ok;
  };
  const routes = buildRoutes({ role, workRoot, jobs, releases, dockerOk });

  function fail(res: ServerResponse, e: unknown): void {
    const status = e instanceof HttpFail ? e.status : e instanceof SpecError ? 400 : 500;
    const code = e instanceof HttpFail ? e.code : e instanceof SpecError ? 'invalid_spec' : 'internal_error';
    const message = e instanceof Error ? e.message : String(e);
    if (status >= 500) log.error('request failed', { error: message });
    if (!res.headersSent) {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { code, message } }));
    } else {
      res.end();
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const u = new URL(req.url ?? '/', 'http://agent');
      const method = (req.method ?? 'GET').toUpperCase();
      const route = routes.find((r) => r.method === method && r.re.test(u.pathname));
      if (!route) throw new HttpFail(404, 'not_found', `${method} ${u.pathname} is not a ship-agent route`);
      if (!route.open) {
        const auth = req.headers.authorization ?? '';
        if (auth !== `Bearer ${token}`) throw new HttpFail(401, 'unauthorized', 'missing or invalid bearer token');
      }
      if (route.roles.length > 0 && role !== 'both' && !route.roles.includes(role)) {
        throw new HttpFail(403, 'wrong_role', `agent role '${role}' does not serve ${method} ${u.pathname}`);
      }
      const ctx: RouteCtx = { req, params: route.re.exec(u.pathname)?.slice(1) ?? [], query: u.searchParams };
      if (method !== 'GET' && method !== 'HEAD') ctx.json = await readJson(req);
      const out = await route.handler(ctx);
      res.writeHead(out.status, { 'content-type': out.contentType ?? 'application/json; charset=utf-8' });
      res.end(out.contentType ? String(out.body ?? '') : JSON.stringify(out.body ?? { ok: true }));
    } catch (e) {
      fail(res, e);
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address() as AddressInfo;
  log.info(`ship-agent listening on ${host}:${address.port}`, { role, workRoot });
  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  startAgent()
    .then((agent) => {
      const shutdown = () => {
        void agent.close().then(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((e: unknown) => {
      console.error(`ship-agent failed to start: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
