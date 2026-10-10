import { ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MachineAuthService } from './machine-auth.service.js';
import { MACHINE_HANDLER_METADATA, MACHINE_METHODS, type MachineHandlerMetadata } from './machine-handler.js';
import { assertMachineIngress, machineHeader } from './machine-ingress.js';
import { MachineIngressSettings } from './machine-ingress.settings.js';
import type { MachineRequest } from './machine-request.js';

@Injectable()
export class MachineRequestGuard {
  constructor(@Inject(MachineAuthService) private readonly auth: MachineAuthService,
    @Inject(MachineIngressSettings) private readonly settings: MachineIngressSettings) {}
  async tryAuthenticate(context: ExecutionContext): Promise<boolean | null> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest<MachineRequest>();
    delete request.machineContext;
    if (!Reflect.hasOwnMetadata(MACHINE_HANDLER_METADATA, handler)) return null;
    const metadata = Reflect.getOwnMetadata(MACHINE_HANDLER_METADATA, handler) as MachineHandlerMetadata | undefined;
    const rule = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      && typeof metadata.capability === 'string' && Object.hasOwn(MACHINE_METHODS, metadata.capability) ? MACHINE_METHODS[metadata.capability] : undefined;
    if (!rule || metadata?.authMode !== rule.authMode || request.method !== 'POST' || request.path !== rule.path
      || !metadata || Object.keys(metadata).sort().join(',') !== 'authMode,capability') {
      throw new ForbiddenException('机器方法标记不符合闭合协议');
    }
    assertMachineIngress(request, this.settings);
    request.machineContext = await this.auth.authenticate(rule.authMode, machineHeader(request, 'authorization'));
    return true;
  }
}

export const machineAuthProviders = [MachineIngressSettings, MachineAuthService, MachineRequestGuard];
