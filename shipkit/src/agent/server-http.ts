// HTTP admission and durable Job recovery run only after lifecycle ownership is held.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { SpecError } from '../shared/spec-schema.js';
import type { Logger } from '../shared/log.js';
import type { AgentRole } from '../shared/types.js';
import { readJson } from './body.js';
import { HttpFail } from './http-fail.js';
import { JobStore } from './jobs.js';
import { buildRoutes, type RouteCtx } from './routes.js';
import { ReleaseStore } from './release.js';
import { SecurityStore } from './security.js';

export interface AgentHandle { url: string; port: number; close(): Promise<void> }
interface AgentHttpOptions {
  role: AgentRole; token: string; host: string; port: number; workRoot: string;
  dockerOk(): Promise<boolean>; log: Logger; drainOnClose: boolean;
}
export async function startAgentHttp(options: AgentHttpOptions): Promise<AgentHandle> {
  const { role, token, host, port, workRoot, dockerOk, log, drainOnClose } = options;
  const jobs = new JobStore(workRoot);
  await jobs.loadPersisted();
  const releases = new ReleaseStore(path.join(workRoot, 'apps'));
  const security = new SecurityStore(path.join(workRoot, 'security.json'));
  await security.load();
  const routes = buildRoutes({ role, workRoot, jobs, releases, dockerOk, security });

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
      let authRole: AgentRole | null = null;
      if (!route.open) {
        const auth = req.headers.authorization ?? '';
        const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        // master token = full access to this agent's role; a paired token is scoped to the
        // role that was bound to its pairing code (e.g. a builder credential cannot deploy)
        let effective: AgentRole | null = null;
        if (bearer && bearer === token) effective = role;
        else if (bearer) effective = await security.authenticate(bearer);
        if (!effective) throw new HttpFail(401, 'unauthorized', 'missing or invalid bearer token');
        if (route.roles.length > 0 && effective !== 'both' && !route.roles.includes(effective)) {
          throw new HttpFail(403, 'wrong_role', `credential role '${effective}' does not serve ${method} ${u.pathname}`);
        }
        authRole = effective;
      }
      const ctx: RouteCtx = { req, params: route.re.exec(u.pathname)?.slice(1) ?? [], query: u.searchParams };
      // raw routes own their body (LEGACY-02): the JSON reader must never consume it first
      if (!route.raw && method !== 'GET' && method !== 'HEAD') ctx.json = await readJson(req);
      if (authRole) ctx.auth = { role: authRole };
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
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (drainOnClose) await jobs.drain();
    },
  };
}
