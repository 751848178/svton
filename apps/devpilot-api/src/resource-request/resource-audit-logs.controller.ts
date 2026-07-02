import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListResourceAuditLogsQueryDto } from './dto/resource-request.dto';
import { ResourceAuditLogAccessService } from './resource-audit-log-access.service';
import { ResourceRequestService } from './resource-request.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('resource-audit-logs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceAuditLogsController {
  constructor(
    private readonly auditLogAccess: ResourceAuditLogAccessService,
    private readonly resourceRequestService: ResourceRequestService,
  ) {}

  @Get()
  async findAll(@Request() req: AuthRequest, @Query() query: ListResourceAuditLogsQueryDto) {
    const logs = await this.resourceRequestService.listAuditLogs(req.teamId, query);
    return this.auditLogAccess.filterReadable({
      teamId: req.teamId,
      actorId: req.user.id,
      logs,
    });
  }
}
