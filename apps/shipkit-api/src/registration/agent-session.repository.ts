import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentHeartbeatReceipt, AgentSessionOpenReceipt } from 'shipkit/platform';
import { DatabaseService } from '../database/database.service.js';
import { parseRegistrationInput } from './fault.js';
import type { MachineContext } from './machine-request.js';
import { recordAgentHeartbeat } from './session-heartbeat.js';
import { openAgentSession } from './session-open.js';
import { registrationTransaction, type RegistrationClock } from './transaction.js';
import { loadRegistrationProtocol } from './protocol.js';

@Injectable()
export class AgentSessionRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject('REGISTRATION_CLOCK') private readonly clock: RegistrationClock = () => new Date()) {}

  async open(context: MachineContext, body: unknown): Promise<AgentSessionOpenReceipt> {
    const { parseAgentSessionOpenRequest } = await loadRegistrationProtocol();
    const request = parseRegistrationInput(parseAgentSessionOpenRequest, body);
    return registrationTransaction(this.db, (tx, now) => openAgentSession(tx, context, request, now), this.clock);
  }
  async heartbeat(context: MachineContext, body: unknown): Promise<AgentHeartbeatReceipt> {
    const { parseAgentHeartbeatRequest } = await loadRegistrationProtocol();
    const request = parseRegistrationInput(parseAgentHeartbeatRequest, body);
    return registrationTransaction(this.db, (tx, now) => recordAgentHeartbeat(tx, context, request, now), this.clock);
  }
}
