// Authenticated job cancellation, durable event and byte-cursor log transport.
import { isTerminalJob } from '../shared/job-protocol.js';
import { HttpFail } from './http-fail.js';
import type { Route, RouteCtx, RouteDeps } from './route-types.js';
import { canReadJob, jobRole } from './job-role.js';
function jobFor(d: RouteDeps, ctx: RouteCtx) {
  const job = d.jobs.get(ctx.params[0] ?? '');
  if (!job) throw new HttpFail(404, 'job_not_found', 'job does not exist');
  if (!ctx.auth || !canReadJob(job, ctx.auth.role)) throw new HttpFail(403, 'wrong_role', `job requires ${jobRole(job)} credentials`);
  return job;
}
function cursor(raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new HttpFail(400, 'bad_request', 'invalid cursor or limit');
  return value;
}
export function jobControlRoutes(d: RouteDeps): Route[] {
  return [
    { method: 'POST', re: /^\/api\/jobs\/([0-9a-f-]{36})\/cancel$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const job = jobFor(d, ctx);
      const body = ctx.json as { reason?: unknown } | undefined;
      if (body?.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 500)) throw new HttpFail(400, 'bad_request', 'reason must be a string of at most 500 characters');
      const result = await d.jobs.cancel(job.id, body?.reason as string | undefined);
      return { status: isTerminalJob(result.status) ? 200 : 202, body: result };
    } },
    { method: 'GET', re: /^\/api\/jobs\/([0-9a-f-]{36})\/events$/, roles: ['builder', 'runtime'], handler: async (ctx) => {
      const job = jobFor(d, ctx);
      return { status: 200, body: await d.jobs.events(job.id, cursor(ctx.query.get('after'), 0)) };
    } },
  ];
}
export async function cursorLog(d: RouteDeps, ctx: RouteCtx) {
  const job = jobFor(d, ctx);
  const offset = cursor(ctx.query.get('offset'), 0);
  const limit = cursor(ctx.query.get('limit'), 131072, 131072);
  if (!limit || limit < 4) throw new HttpFail(400, 'bad_request', 'limit must be at least 4 bytes');
  try { return await d.jobs.logPage(job.id, offset, limit); }
  catch (error) { throw new HttpFail(400, 'bad_cursor', (error as Error).message); }
}
