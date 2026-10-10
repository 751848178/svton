import { Inject, Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { registeredAgentView } from './registered-agent.view.js';
import type { RegistrationClock } from './transaction.js';
import { registeredAgentSelect } from './registered-agent.select.js';

@Injectable()
export class RegisteredAgentDirectory {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject('REGISTRATION_CLOCK') private readonly clock: RegistrationClock = () => new Date()) {}
  async list(workspaceId: string) {
    const agents = await this.db.agent.findMany({ where: { workspaceId }, select: registeredAgentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    const now = this.clock();
    return Promise.all(agents.map(agent => registeredAgentView(agent, now)));
  }
}
