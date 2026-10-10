import { Inject, Injectable } from '@nestjs/common';
import { EnrollmentRepository } from './enrollment.repository.js';
import { AgentSessionRepository } from './agent-session.repository.js';
import type { EnrollmentContext, MachineContext } from './machine-request.js';

@Injectable()
export class RegistrationMachineService {
  constructor(@Inject(EnrollmentRepository) private readonly enrollments: EnrollmentRepository,
    @Inject(AgentSessionRepository) private readonly sessions: AgentSessionRepository) {}
  enroll(context: EnrollmentContext, body: unknown) { return this.enrollments.consume(context, body); }
  open(context: MachineContext, body: unknown) { return this.sessions.open(context, body); }
  heartbeat(context: MachineContext, body: unknown) { return this.sessions.heartbeat(context, body); }
}
