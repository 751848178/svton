import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { AuditEventService } from './audit-event.service';
import { ListAuditEventsQueryDto } from './dto/audit-event.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableAuditEvent = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

@Controller('audit-events')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class AuditEventController {
  constructor(
    private readonly auditEventService: AuditEventService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListAuditEventsQueryDto,
  ) {
    const events = await this.auditEventService.list(req.teamId, query);
    return this.filterReadableAuditEvents(req, events);
  }

  private async filterReadableAuditEvents<T extends ReadableAuditEvent>(
    req: AuthRequest,
    events: T[],
  ) {
    const allowed = await Promise.all(events.map(async (event) => ({
      event,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: event.projectId,
        environmentId: event.environmentId,
        category: 'audit',
        action: 'audit_event.read',
        targetType: 'audit_event',
        targetId: event.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.event);
  }
}
