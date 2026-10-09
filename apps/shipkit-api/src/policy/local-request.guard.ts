import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { LocalRequest } from './request-context.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

@Injectable()
export class LocalRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<LocalRequest>();
    const host = request.get('host') ?? '';
    if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?$/i.test(host)) throw new ForbiddenException('仅接受有效本机 Host');
    let hostname: string;
    try { hostname = new URL(`http://${host}`).hostname; } catch { throw new ForbiddenException('无效本机来源'); }
    if (!LOOPBACK.has(hostname)) throw new ForbiddenException('仅接受本机来源');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.get('x-shipkit-local') !== '1' || !request.is('application/json')) {
        throw new ForbiddenException('本机操作需要 JSON 和 x-shipkit-local 请求标识');
      }
      const origin = request.get('origin');
      if (origin) {
        let url: URL;
        try { url = new URL(origin); } catch { throw new ForbiddenException('无效操作来源'); }
        const allowedPorts = new Set(['8769', '8770', process.env.PORT ?? '8770']);
        if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname) || !allowedPorts.has(url.port) || url.origin !== origin) {
          throw new ForbiddenException('操作来源必须为本机 Shipkit 页面');
        }
      }
    }
    request.localContext = { actorId: 'local-controller', workspaceId: 'local', requestId: randomUUID(), source: 'loopback' };
    return true;
  }
}
