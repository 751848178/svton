// Route table for the agent's open HTTP API. Transport (auth, body parsing,
// error envelopes) lives in server.ts; each route group owns its handlers.

export type { Route, RouteCtx, RouteOut, RouteDeps } from './route-types.js';
import type { Route, RouteDeps } from './route-types.js';
import { lifecycleRoutes } from './routes-lifecycle.js';
import { pairingRoutes } from './routes-pairing.js';
import { imageRoutes } from './routes-images.js';
import { registryRoutes } from './routes-registry.js';

export function buildRoutes(d: RouteDeps): Route[] {
  return [...lifecycleRoutes(d), ...pairingRoutes(d), ...imageRoutes(d), ...registryRoutes(d)];
}
