import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestContext } from './request-context.js';

@Injectable()
export class LocalPolicyService {
  authorize(context: RequestContext, _action: string, workspaceId = 'local'): void {
    if (context.source !== 'loopback' || context.workspaceId !== workspaceId || context.actorId !== 'local-controller') {
      throw new ForbiddenException('资源不属于当前本机工作空间');
    }
  }
}
