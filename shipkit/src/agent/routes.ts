// Route table for the agent's open HTTP API. Transport concerns live in server.ts.

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { validateSpec } from '../shared/spec-schema.js';
import { exec } from '../shared/exec.js';
import {
  SHIP_VERSION,
  type AgentRole,
  type AgentStatus,
  type BuildRequest,
  type DeployRequest,
  type PushRequest,
  type RollbackRequest,
} from '../shared/types.js';
import { streamBodyToFile } from './body.js';
import { runBuild } from './handlers-build.js';
import { runPush } from './handlers-push.js';
import { runDeploy, runRollback } from './handlers-deploy.js';
import { HttpFail } from './http-fail.js';
import type { JobStore } from './jobs.js';
import type { ReleaseStore } from './release.js';
import { newTarballId } from './source.js';
import { executeImageGc, planImageGc, previewImageGc } from './gc.js';

export interface RouteCtx {
  req: IncomingMessage;
  params: string[];
  query: URLSearchParams;
  json?: unknown;
}

export interface RouteOut {
  status: number;
  body?: unknown;
  contentType?: string;
}

export interface Route {
  method: string;
  re: RegExp;
  roles: AgentRole[];
  raw?: boolean;
  open?: boolean;
  handler: (ctx: RouteCtx) => Promise<RouteOut>;
}

export interface RouteDeps {
  role: AgentRole;
  workRoot: string;
  jobs: JobStore;
  releases: ReleaseStore;
  dockerOk: () => Promise<boolean>;
}

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

export function buildRoutes(d: RouteDeps): Route[] {
  const requireDocker = async () => {
    if (!(await d.dockerOk())) throw new HttpFail(503, 'docker_unavailable', 'docker is not usable on this machine');
  };

  return [
    { method: 'GET', re: /^\/health$/, roles: [], open: true, handler: async () => ({ status: 200, body: { ok: true, role: d.role, version: SHIP_VERSION, docker: await d.dockerOk() } }) },

    { method: 'POST', re: /^\/api\/sources$/, roles: ['builder'], raw: true, handler: async (ctx) => {
      await requireDocker();
      const id = newTarballId();
      const sourcesRoot = path.join(d.workRoot, 'sources');
      const dir = path.join(sourcesRoot, `tar-${id}`);
      const incoming = path.join(sourcesRoot, `${id}.incoming`);
      await mkdir(sourcesRoot, { recursive: true });
      await mkdir(dir, { recursive: true });
      try {
        const bytes = await streamBodyToFile(ctx.req, RAW_LIMIT, incoming);
        const r = await exec('tar', ['-xzf', incoming, '-C', dir], { timeoutMs: 5 * 60_000 });
        if (r.code !== 0) throw new HttpFail(400, 'bad_tarball', `tar extract failed (exit ${r.code}): ${r.stderr.slice(0, 300)}`);
        if (bytes === 0) throw new HttpFail(400, 'bad_request', 'tar.gz body required');
      } finally {
        await rm(incoming, { force: true });
      }
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
      await requireDocker();
      const job = d.jobs.create('build', (jctx) => runBuild(d.workRoot, req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/push$/, roles: ['builder'], handler: async (ctx) => {
      const req = body(ctx) as unknown as PushRequest;
      if (typeof req.name !== 'string' || typeof req.tag !== 'string') throw new HttpFail(400, 'bad_request', 'name + tag required');
      if (!req.registry && !process.env.SHIP_REGISTRY) throw new HttpFail(400, 'registry_missing', 'pass registry in the request or set SHIP_REGISTRY on the builder');
      await requireDocker();
      const job = d.jobs.create('push', (jctx) => runPush(req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/deploy$/, roles: ['runtime'], handler: async (ctx) => {
      const req = body(ctx) as unknown as DeployRequest;
      if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', `app must match ${APP_NAME_RE}`);
      if (typeof req.imageRef !== 'string' || /\s/.test(req.imageRef)) throw new HttpFail(400, 'bad_request', 'imageRef required (no whitespace)');
      validateSpec(req.spec);
      await requireDocker();
      const job = d.jobs.create('deploy', (jctx) => runDeploy(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/rollback$/, roles: ['runtime'], handler: async (ctx) => {
      const req = body(ctx) as unknown as RollbackRequest;
      if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', 'app required');
      await requireDocker();
      const job = d.jobs.create('rollback', (jctx) => runRollback(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'GET', re: /^\/api\/status$/, roles: ['builder', 'runtime'], handler: async () => {
      const status: AgentStatus = {
        role: d.role,
        version: SHIP_VERSION,
        workRoot: d.workRoot,
        docker: await d.dockerOk(),
        activeJobs: d.jobs.activeCount(),
      };
      if (d.role === 'runtime' || d.role === 'both') status.apps = await d.releases.list();
      return { status: 200, body: status };
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
      const job = d.jobs.create('gc', async (jctx) => {
        const plan = await planImageGc(appsRoot);
        const result = await executeImageGc(appsRoot, plan, jctx.log);
        return { mode: 'execute', candidates: plan.candidates.length, ...result };
      });
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'GET', re: /^\/api\/jobs$/, roles: ['builder', 'runtime'], handler: async () => ({ status: 200, body: { jobs: d.jobs.list() } }) },

    { method: 'GET', re: /^\/api\/jobs\/([0-9a-f-]{36})$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const id = ctx.params[0] ?? '';
      if (!JOB_ID_RE.test(id)) throw new HttpFail(404, 'job_not_found', `no job ${id}`);
      const job = d.jobs.get(id);
      if (!job) throw new HttpFail(404, 'job_not_found', `no job ${id}`);
      return { status: 200, body: job };
    } },

    { method: 'GET', re: /^\/api\/jobs\/([0-9a-f-]{36})\/log$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const id = ctx.params[0] ?? '';
      if (!JOB_ID_RE.test(id)) throw new HttpFail(404, 'job_not_found', `no job ${id}`);
      const job = d.jobs.get(id);
      if (!job) throw new HttpFail(404, 'job_not_found', `no job ${id}`);
      const tail = Number(ctx.query.get('tail') ?? 200);
      const log = (await d.jobs.readLog(id, Math.min(Math.max(tail, 1), 2000))) ?? '';
      return { status: 200, body: log, contentType: 'text/plain; charset=utf-8' };
    } },
  ];
}
