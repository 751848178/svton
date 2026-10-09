import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestContext } from './request-context.js';
import { createAuthorizer } from '@svton/authz';

@Injectable()
export class LocalPolicyService {
  private readonly authorizer = createAuthorizer({ roles: { authenticated: { permissions: [['*', '*']] } } });
  authorize(context: RequestContext, action: string, workspaceId = 'local'): void {
    if (context.source !== 'session' || !context.actorId || !context.sessionId || context.workspaceId !== workspaceId) {
      throw new ForbiddenException('需要有效登录会话及当前工作空间');
    }
    const [resource, operation] = action.split('.');
    const scope = { type: 'workspace', id: workspaceId };
    // MVP grants every authenticated member all operations; this seam carries
    // the real subject/action/scope for a future authorization policy.
    if (!this.authorizer.can({ subject: { roles: [{ role: 'authenticated', scope }] }, permission: [resource!, operation ?? '*'], scope }).allowed) {
      throw new ForbiddenException('当前操作不可用');
    }
  }
}
