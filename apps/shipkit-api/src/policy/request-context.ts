import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/contracts.js';

export interface RequestContext {
  actorId: string;
  workspaceId: string;
  requestId: string;
  source: 'loopback' | 'session';
  sessionId?: string;
}

export interface LocalRequest extends Request { localContext: RequestContext; authentication?: AuthenticatedRequest }
export const requestContext = (request: LocalRequest): RequestContext => request.localContext;
