import type { Request } from 'express';

export interface RequestContext {
  actorId: string;
  workspaceId: string;
  requestId: string;
  source: 'loopback';
}

export interface LocalRequest extends Request { localContext: RequestContext }
export const requestContext = (request: LocalRequest): RequestContext => request.localContext;
