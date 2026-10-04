// Pairing exchange route: self-authenticated by the one-time code; role scoping
// happens when the minted token is used, not here. Labels never contain secrets
// and are not echoed back.

import { HttpFail } from './http-fail.js';
import type { Route, RouteCtx, RouteDeps } from './route-types.js';

function body(ctx: RouteCtx): Record<string, unknown> {
  if (!ctx.json || typeof ctx.json !== 'object') throw new HttpFail(400, 'bad_request', 'JSON body required');
  return ctx.json as Record<string, unknown>;
}

export function pairingRoutes(d: RouteDeps): Route[] {
  return [
    { method: 'POST', re: /^\/api\/pairing\/exchange$/, roles: [], open: true, handler: async (ctx) => {
      const req = body(ctx) as { code?: unknown; label?: unknown };
      if (typeof req.code !== 'string' || req.code.length < 10) throw new HttpFail(400, 'bad_request', 'pairing code required');
      const label = typeof req.label === 'string' && req.label ? req.label.slice(0, 64).replace(/[\x00-\x1f]/g, '') : 'paired';
      const out = await d.security.exchange(req.code, label);
      return { status: 200, body: { token: out.token, role: out.role, agentRole: d.role } };
    } },
  ];
}
