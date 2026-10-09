// Image lifecycle routes: source upload (raw streaming), build, push, deploy,
// rollback and garbage collection.

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { validateSpec } from '../shared/spec-schema.js';
import { validEnvironmentIdentity, validProjectIdentity } from '../shared/deployment-identity.js';
import { exec } from '../shared/exec.js';
import type { BuildRequest, DeployRequest, PushRequest, RollbackRequest } from '../shared/types.js';
import { streamBodyToFile } from './body.js';
import { runBuild } from './handlers-build.js';
import { runPush } from './handlers-push.js';
import { runDeploy, runRollback } from './handlers-deploy.js';
import { HttpFail } from './http-fail.js';
import { newTarballId } from './source.js';
import { executeImageGc, planImageGc, previewImageGc } from './gc.js';
import { requireDocker } from './route-guards.js';
import type { Route, RouteCtx, RouteDeps } from './route-types.js';

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APP_NAME_RE = /^[a-z][a-z0-9-]{0,62}$/;
const RAW_LIMIT = 300 * 1024 * 1024;

function body(ctx: RouteCtx): Record<string, unknown> {
  if (!ctx.json || typeof ctx.json !== 'object') throw new HttpFail(400, 'bad_request', 'JSON body required');
  return ctx.json as Record<string, unknown>;
}

/** keep at most 20 recent tar sources, older than 24h (F34) */
async function gcSources(sourcesRoot: string): Promise<void> {
  const entries = (await readdir(sourcesRoot, { withFileTypes: true }).catch(() => [])).filter(
    (e) => e.isDirectory() && e.name.startsWith('tar-'),
  );
  const aged: Array<{ p: string; m: number }> = [];
  for (const e of entries) {
    const p = path.join(sourcesRoot, e.name);
    aged.push({ p, m: (await stat(p).catch(() => null))?.mtimeMs ?? 0 });
  }
  aged.sort((a, b) => b.m - a.m);
  for (const { p, m } of aged.slice(20)) {
    if (Date.now() - m > 24 * 3600_000) await rm(p, { recursive: true, force: true });
  }
}

export function imageRoutes(d: RouteDeps): Route[] {
  const requireDockerNow = requireDocker(d.dockerOk);

  return [
    // raw route: the transport does NOT pre-parse this body as JSON (LEGACY-02);
    // only the size-capped stream reader may consume it
    { method: 'POST', re: /^\/api\/sources$/, roles: ['builder'], raw: true, handler: async (ctx) => {
      await requireDockerNow();
      const id = newTarballId();
      const sourcesRoot = path.join(d.workRoot, 'sources');
      const dir = path.join(sourcesRoot, `tar-${id}`);
      const incoming = path.join(sourcesRoot, `${id}.incoming`);
      await mkdir(sourcesRoot, { recursive: true });
      try {
        const bytes = await streamBodyToFile(ctx.req, RAW_LIMIT, incoming);
        if (bytes === 0) throw new HttpFail(400, 'bad_request', 'tar.gz body required (got an empty body)');
        await mkdir(dir, { recursive: true });
        const r = await exec('tar', ['-xzf', incoming, '-C', dir], { timeoutMs: 5 * 60_000 });
        if (r.code !== 0) throw new HttpFail(400, 'bad_tarball', `tar extract failed (exit ${r.code}): ${r.stderr.slice(0, 300)}`);
      } catch (e) {
        // failed uploads leave neither the partial dir nor the incoming temp behind
        await rm(dir, { recursive: true, force: true });
        await rm(incoming, { force: true });
        throw e;
      }
      await rm(incoming, { force: true });
      await gcSources(sourcesRoot);
      return { status: 201, body: { id } };
    } },

    { method: 'POST', re: /^\/api\/build$/, roles: ['builder'], handler: async (ctx) => {
      const req = body(ctx) as unknown as BuildRequest;
      validateSpec(req.spec);
      const src = req.source;
      if (!src || (src.type !== 'git' && src.type !== 'tarball')) throw new HttpFail(400, 'bad_request', 'source.type must be git|tarball');
      if (src.type === 'git' && typeof src.repo !== 'string') throw new HttpFail(400, 'bad_request', 'source.repo required');
      if (src.type === 'tarball' && !JOB_ID_RE.test(String(src.id))) throw new HttpFail(400, 'bad_request', 'source.id must be a uuid from POST /api/sources');
      await requireDockerNow();
      const job = await d.jobs.create('build', (jctx) => runBuild(d.workRoot, req, jctx.log, jctx), true, { operationId: req.operationId, request: req });
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/push$/, roles: ['builder'], handler: async (ctx) => {
      const req = body(ctx) as unknown as PushRequest;
      if (typeof req.name !== 'string' || typeof req.tag !== 'string') throw new HttpFail(400, 'bad_request', 'name + tag required');
      if (!req.registry && !process.env.SHIP_REGISTRY) throw new HttpFail(400, 'registry_missing', 'pass registry in the request or set SHIP_REGISTRY on the builder');
      await requireDockerNow();
      const job = await d.jobs.create('push', (jctx) => runPush(req, jctx.log, d.workRoot, jctx), true, { operationId: req.operationId, request: req });
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/deploy$/, roles: ['runtime'], handler: async (ctx) => {
      const req = body(ctx) as unknown as DeployRequest;
      if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', `app must match ${APP_NAME_RE}`);
      if (!validProjectIdentity(req.project)) {
        throw new HttpFail(400, 'bad_request', 'project identity required (non-empty, ≤200 chars, no whitespace) — unidentified callers cannot deploy');
      }
      if (!validEnvironmentIdentity(req.env)) {
        throw new HttpFail(400, 'bad_request', 'env identity required (target name, [A-Za-z0-9._-]) — unidentified callers cannot deploy');
      }
      if (typeof req.imageRef !== 'string' || /\s/.test(req.imageRef)) throw new HttpFail(400, 'bad_request', 'imageRef required (no whitespace)');
      if (req.keepEnv !== undefined && typeof req.keepEnv !== 'boolean') throw new HttpFail(400, 'bad_request', 'keepEnv must be a boolean');
      if (req.envFileContent !== undefined && typeof req.envFileContent !== 'string') throw new HttpFail(400, 'bad_request', 'envFileContent must be a string');
      validateSpec(req.spec);
      await requireDockerNow();
      const job = await d.jobs.create('deploy', (jctx) => runDeploy(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/rollback$/, roles: ['runtime'], handler: async (ctx) => {
      const req = body(ctx) as unknown as RollbackRequest;
      if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', 'app required');
      if (!validProjectIdentity(req.project)) {
        throw new HttpFail(400, 'bad_request', 'project identity required — unidentified callers cannot roll back');
      }
      if (!validEnvironmentIdentity(req.env)) {
        throw new HttpFail(400, 'bad_request', 'env identity required (target name, [A-Za-z0-9._-])');
      }
      await requireDockerNow();
      const job = await d.jobs.create('rollback', (jctx) => runRollback(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/gc$/, roles: ['runtime'], handler: async (ctx) => {
      const req = body(ctx) as { dryRun?: boolean };
      const appsRoot = path.join(d.workRoot, 'apps');
      if (req.dryRun !== false) {
        // preview runs under the reader slot: never observes a half-shifted ledger/state
        const plan = await previewImageGc(appsRoot);
        return { status: 200, body: { mode: 'preview', ...plan } };
      }
      // execution is a persistent job: survives client timeouts, pollable, logged (RA10)
      const job = await d.jobs.create('gc', async (jctx) => {
        const plan = await planImageGc(appsRoot);
        const result = await executeImageGc(appsRoot, plan, jctx.log);
        return { mode: 'execute', candidates: plan.candidates.length, ...result };
      });
      return { status: 202, body: { jobId: job.id } };
    } },
  ];
}
