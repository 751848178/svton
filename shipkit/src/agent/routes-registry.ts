// Registry credential distribution + push/pull proof routes (UX07).
// M2-03: every action checks BOTH the caller's effective role (the paired/master
// credential) AND the machine capability — a runtime credential on a both machine
// must not overwrite push creds or start push verifications, and vice versa.

import { HttpFail } from './http-fail.js';
import { writeRegistryCreds, type CredKind } from './registry-creds.js';
import { runVerifyPull, runVerifyPush } from './handlers-verify.js';
import { assertCallerCan, assertMachineCan, requireDocker } from './route-guards.js';
import type { Route, RouteCtx, RouteDeps } from './route-types.js';

function body(ctx: RouteCtx): Record<string, unknown> {
  if (!ctx.json || typeof ctx.json !== 'object') throw new HttpFail(400, 'bad_request', 'JSON body required');
  return ctx.json as Record<string, unknown>;
}

const KIND_ROLE: Record<CredKind, 'builder' | 'runtime'> = { push: 'builder', pull: 'runtime' };

export function registryRoutes(d: RouteDeps): Route[] {
  const requireDockerNow = requireDocker(d.dockerOk);

  return [
    // UX07: role-targeted credential distribution. The password is written to a 0600
    // file in the work root and is never echoed, logged, or returned.
    { method: 'PUT', re: /^\/api\/registry-creds$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const req = body(ctx) as { kind?: unknown; user?: unknown; password?: unknown };
      const kind = req.kind as CredKind;
      if (kind !== 'push' && kind !== 'pull') throw new HttpFail(400, 'bad_request', 'kind must be push|pull');
      assertCallerCan(ctx, KIND_ROLE[kind], `store ${kind} registry credentials`);
      assertMachineCan(d.role, KIND_ROLE[kind], `store ${kind} registry credentials`);
      if (typeof req.user !== 'string' || typeof req.password !== 'string' || !req.user || !req.password) {
        throw new HttpFail(400, 'bad_request', 'user and password are required');
      }
      await writeRegistryCreds(d.workRoot, kind, { user: req.user, password: req.password });
      return { status: 200, body: { ok: true, kind, stored: true } };
    } },

    // UX07: real push/pull proof with a named test object (never auto-deleted remotely)
    { method: 'POST', re: /^\/api\/verify\/registry$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const req = body(ctx) as { mode?: unknown; registry?: unknown; namespace?: unknown; ref?: unknown; digest?: unknown };
      const registry = typeof req.registry === 'string' ? req.registry : '';
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*(:\d{1,5})?$/.test(registry)) throw new HttpFail(400, 'bad_request', 'registry host[:port] required');
      if (req.mode !== 'push' && req.mode !== 'pull') throw new HttpFail(400, 'bad_request', 'mode must be push|pull');
      // capability gates run BEFORE docker probing and job creation (M2-03)
      assertCallerCan(ctx, req.mode === 'push' ? 'builder' : 'runtime', `run a ${req.mode} verification`);
      assertMachineCan(d.role, req.mode === 'push' ? 'builder' : 'runtime', `run a ${req.mode} verification`);
      await requireDockerNow();
      if (req.mode === 'push') {
        const namespace = typeof req.namespace === 'string' ? req.namespace : '';
        if (!/^[a-z0-9][a-z0-9._-]{0,60}$/.test(namespace)) throw new HttpFail(400, 'bad_request', 'namespace required');
        const job = d.jobs.create('verify', (jctx) => runVerifyPush(d.workRoot, { registry, namespace }, jctx.log));
        return { status: 202, body: { jobId: job.id } };
      }
      const ref = typeof req.ref === 'string' ? req.ref : '';
      if (!ref.startsWith(`${registry}/`) || /\s/.test(ref)) throw new HttpFail(400, 'bad_request', 'ref must belong to the given registry');
      const digest = typeof req.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(req.digest) ? req.digest : undefined;
      const job = d.jobs.create('verify', (jctx) => runVerifyPull(d.workRoot, { registry, ref, digest }, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },
  ];
}
