import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { LocalRequestGuard } from '../policy/local-request.guard.js';
import { MachineRequestGuard } from '../registration/machine-request.guard.js';

/** Only explicitly marked machine methods bypass the unchanged human-session guard. */
@Injectable()
export class PlatformRequestGuard implements CanActivate {
  constructor(@Inject(MachineRequestGuard) private readonly machine: MachineRequestGuard,
    @Inject(LocalRequestGuard) private readonly human: LocalRequestGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return (await this.machine.tryAuthenticate(context)) ?? this.human.canActivate(context);
  }
}
