import { Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ListServerExecutionLeasesQueryDto } from './dto/server-execution-lease.dto';
import { ServerExecutorService } from './server-executor.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type AccessScope = {
  projectId?: string | null;
  environmentId?: string | null;
};

type ReadableExecutionLease = {
  id: string;
  metadata?: unknown;
};

@Controller('server-execution-leases')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ServerExecutionLeaseController {
  constructor(
    private readonly serverExecutorService: ServerExecutorService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListServerExecutionLeasesQueryDto,
  ) {
    const leases = await this.serverExecutorService.listLeases(req.teamId, query);
    return this.filterReadableLeases(req, leases);
  }

  @Post('expire-stale')
  @Roles('team_admin')
  expireStale(@Request() req: AuthRequest) {
    return this.serverExecutorService.expireStaleLeasesForTeam(req.teamId);
  }

  private async filterReadableLeases<T extends ReadableExecutionLease>(
    req: AuthRequest,
    leases: T[],
  ) {
    const allowed = await Promise.all(leases.map(async (lease) => {
      const scope = this.getJsonAccessScope(lease.metadata);
      return {
        lease,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: scope.projectId ?? null,
          environmentId: scope.environmentId ?? null,
          category: 'execution',
          action: 'server_execution_lease.read',
          targetType: 'server_execution_lease',
          targetId: lease.id,
          risk: 'low',
        }),
      };
    }));

    return allowed.filter((item) => item.allowed).map((item) => item.lease);
  }

  private getJsonAccessScope(value: unknown): AccessScope {
    const record = this.asRecord(value);
    const sourceMetadata = this.asRecord(record?.sourceMetadata);
    return {
      projectId: this.readString(record?.projectId) || this.readString(sourceMetadata?.projectId),
      environmentId: this.readString(record?.environmentId) || this.readString(sourceMetadata?.environmentId),
    };
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
