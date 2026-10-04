// Route contracts for the agent's open HTTP API (M2 engineering split): transport
// stays in server.ts, each route group owns its handlers, routes.ts only assembles.

import type { IncomingMessage } from 'node:http';
import type { AgentRole } from '../shared/types.js';
import type { JobStore } from './jobs.js';
import type { ReleaseStore } from './release.js';
import type { SecurityStore } from './security.js';

export interface RouteCtx {
  req: IncomingMessage;
  params: string[];
  query: URLSearchParams;
  json?: unknown;
  /** identity established by the transport's auth layer: the EFFECTIVE role of the
   *  caller (master token → machine role; paired token → the code's bound role).
   *  Composite actions must gate on this, never on the machine role alone (M2-03). */
  auth?: { role: AgentRole };
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
  /** raw bodies bypass the JSON reader and are consumed by the handler's stream */
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
  security: SecurityStore;
}
