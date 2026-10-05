// Multi-service group routes: read-only state for release planning (MS-01) and
// the deploy/rollback job endpoints (MS-03/04). Deploy/rollback handlers live
// in handlers-group-*.ts; this file only validates the wire contract.

import path from 'node:path';
import { validateProjectSpec } from '../shared/spec-v2.js';
import { validEnvironmentIdentity, validProjectIdentity } from '../shared/deployment-identity.js';
import type { GroupDeployRequest, GroupRollbackRequest } from '../shared/group-protocol.js';
import { HttpFail } from './http-fail.js';
import { GroupStore } from './group-store.js';
import { assertProjectBinding, inspectProjectBinding } from './project-binding.js';
import { runGroupDeploy } from './handlers-group-deploy.js';
import { runGroupRollback } from './handlers-group-rollback.js';
import { requireDocker } from './route-guards.js';
import type { Route, RouteDeps } from './route-types.js';

const APP_NAME_RE = /^[a-z][a-z0-9-]{0,62}$/;

function parseDeployRequest(ctxJson: unknown): GroupDeployRequest {
  if (!ctxJson || typeof ctxJson !== 'object') throw new HttpFail(400, 'bad_request', 'JSON body required');
  const req = ctxJson as Record<string, unknown>;
  if (req.schemaVersion !== 2) throw new HttpFail(400, 'bad_request', 'schemaVersion must be 2 for group deploys');
  if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', `app must match ${APP_NAME_RE}`);
  if (!validProjectIdentity(req.project)) throw new HttpFail(400, 'bad_request', 'project identity required — unidentified callers cannot deploy');
  if (!validEnvironmentIdentity(req.env)) throw new HttpFail(400, 'bad_request', 'env identity required (target name)');
  if (!req.changed || typeof req.changed !== 'object' || Array.isArray(req.changed) || Object.keys(req.changed).length === 0) {
    throw new HttpFail(400, 'bad_request', 'changed must be a non-empty mapping of service name to change');
  }
  for (const [name, change] of Object.entries(req.changed as Record<string, unknown>)) {
    if (typeof change !== 'object' || change === null) throw new HttpFail(400, 'bad_request', `changed.${name} must be a mapping`);
    const c = change as Record<string, unknown>;
    if (typeof c.imageRef !== 'string' || /\s/.test(c.imageRef)) throw new HttpFail(400, 'bad_request', `changed.${name}.imageRef required (no whitespace)`);
    if (c.envFileContent !== undefined && typeof c.envFileContent !== 'string') throw new HttpFail(400, 'bad_request', `changed.${name}.envFileContent must be a string`);
    if (c.keepEnv !== undefined && typeof c.keepEnv !== 'boolean') throw new HttpFail(400, 'bad_request', `changed.${name}.keepEnv must be a boolean`);
    if (c.source !== undefined && (typeof c.source !== 'object' || !['git', 'tarball'].includes(String((c.source as Record<string, unknown>).type)))) {
      throw new HttpFail(400, 'bad_request', `changed.${name}.source.type must be git|tarball`);
    }
  }
  validateProjectSpec(req.spec);
  return req as unknown as GroupDeployRequest;
}

function parseRollbackRequest(ctxJson: unknown): GroupRollbackRequest {
  if (!ctxJson || typeof ctxJson !== 'object') throw new HttpFail(400, 'bad_request', 'JSON body required');
  const req = ctxJson as Record<string, unknown>;
  if (typeof req.app !== 'string' || !APP_NAME_RE.test(req.app)) throw new HttpFail(400, 'bad_request', 'app required');
  if (!validProjectIdentity(req.project)) throw new HttpFail(400, 'bad_request', 'project identity required — unidentified callers cannot roll back');
  if (!validEnvironmentIdentity(req.env)) throw new HttpFail(400, 'bad_request', 'env identity required');
  if (req.services !== undefined) {
    if (!Array.isArray(req.services) || req.services.length === 0 || req.services.some((s) => typeof s !== 'string' || !APP_NAME_RE.test(s))) {
      throw new HttpFail(400, 'bad_request', 'services must be a non-empty list of service names');
    }
  }
  if (req.baseReleaseId !== undefined && (typeof req.baseReleaseId !== 'string' || !/^[a-z0-9-]{6,40}$/.test(req.baseReleaseId))) {
    throw new HttpFail(400, 'bad_request', 'baseReleaseId must be a release id string');
  }
  return req as unknown as GroupRollbackRequest;
}

export function groupRoutes(d: RouteDeps): Route[] {
  const store = () => new GroupStore(path.join(d.workRoot, 'apps'));
  const requireDockerNow = requireDocker(d.dockerOk);
  return [
    // read-only current combination for release planning; verifies the caller's
    // identity against the group binding but never mutates anything
    { method: 'GET', re: /^\/api\/group-state$/, roles: ['runtime'], handler: async (ctx) => {
      const app = ctx.query.get('app') ?? '';
      if (!APP_NAME_RE.test(app)) throw new HttpFail(400, 'bad_request', `app must match ${APP_NAME_RE}`);
      const project = ctx.query.get('project') ?? '';
      const env = ctx.query.get('env') ?? '';
      if (!validProjectIdentity(project)) throw new HttpFail(400, 'bad_request', 'project identity required');
      if (!validEnvironmentIdentity(env)) throw new HttpFail(400, 'bad_request', 'env identity required');
      const s = store();
      await s.assertLayout(app);
      const appDir = s.appDir(app);
      // read-only: an EXISTING binding must match exactly (verified without
      // claiming); an unclaimed name reports a fresh empty state — planning
      // must never write anything
      if (await inspectProjectBinding(appDir)) {
        await assertProjectBinding(appDir, { app, project, env }, false, false);
      }
      const state = await s.loadState(app);
      const current = state.current ? await s.loadRelease(app, state.current) : null;
      const services: Record<string, { imageRef: string; hasEnv: boolean; spec: unknown }> = {};
      for (const [name, entry] of Object.entries(current?.services ?? {})) {
        services[name] = { imageRef: entry.imageRef, hasEnv: entry.hasEnv, spec: entry.spec };
      }
      return { status: 200, body: { schemaVersion: 2, app, current: state.current, updatedAt: state.updatedAt, services } };
    } },

    { method: 'POST', re: /^\/api\/deploy-group$/, roles: ['runtime'], handler: async (ctx) => {
      const req = parseDeployRequest(ctx.json);
      await requireDockerNow();
      const job = d.jobs.create('group-deploy', (jctx) => runGroupDeploy(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },

    { method: 'POST', re: /^\/api\/rollback-group$/, roles: ['runtime'], handler: async (ctx) => {
      const req = parseRollbackRequest(ctx.json);
      await requireDockerNow();
      const job = d.jobs.create('group-rollback', (jctx) => runGroupRollback(path.join(d.workRoot, 'apps'), req, jctx.log));
      return { status: 202, body: { jobId: job.id } };
    } },
  ];
}
