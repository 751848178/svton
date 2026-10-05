// Read-side routes: health, self-authenticated status (reports the CALLER's
// effective permissions, M2-04) and job polling.

import path from 'node:path';
import { SHIP_VERSION, type AgentStatus } from '../shared/types.js';
import { GroupStore } from './group-store.js';
import { HttpFail } from './http-fail.js';
import type { Route, RouteCtx, RouteDeps } from './route-types.js';
import { capabilitiesFor } from './route-guards.js';

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function jobOrFail(d: RouteDeps, id: string): unknown {
  if (!JOB_ID_RE.test(id) || !d.jobs.get(id)) throw new HttpFail(404, 'job_not_found', `no job ${id}`);
  return d.jobs.get(id);
}

export function lifecycleRoutes(d: RouteDeps): Route[] {
  return [
    { method: 'GET', re: /^\/health$/, roles: [], open: true, handler: async () => ({ status: 200, body: { ok: true, role: d.role, version: SHIP_VERSION, docker: await d.dockerOk() } }) },

    // M2-04: the status body reports what THIS credential may do. Machine role stays
    // as `role`; clients must gate on `auth`, not on `role`.
    { method: 'GET', re: /^\/api\/status$/, roles: ['builder', 'runtime'], handler: async (ctx: RouteCtx) => {
      const effective = ctx.auth?.role ?? d.role;
      const status: AgentStatus = {
        role: d.role,
        version: SHIP_VERSION,
        workRoot: d.workRoot,
        docker: await d.dockerOk(),
        activeJobs: d.jobs.activeCount(),
        auth: { role: effective, capabilities: capabilitiesFor(effective) },
      };
      if (d.role === 'runtime' || d.role === 'both') {
        status.apps = await d.releases.list();
        status.groups = await new GroupStore(path.join(d.workRoot, 'apps')).list();
      }
      return { status: 200, body: status };
    } },

    { method: 'GET', re: /^\/api\/jobs$/, roles: ['builder', 'runtime'], handler: async () => ({ status: 200, body: { jobs: d.jobs.list() } }) },

    { method: 'GET', re: /^\/api\/jobs\/([0-9a-f-]{36})$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      return { status: 200, body: jobOrFail(d, ctx.params[0] ?? '') };
    } },

    { method: 'GET', re: /^\/api\/jobs\/([0-9a-f-]{36})\/log$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const id = ctx.params[0] ?? '';
      jobOrFail(d, id);
      const tail = Number(ctx.query.get('tail') ?? 200);
      const log = (await d.jobs.readLog(id, Math.min(Math.max(tail, 1), 2000))) ?? '';
      return { status: 200, body: log, contentType: 'text/plain; charset=utf-8' };
    } },
  ];
}
