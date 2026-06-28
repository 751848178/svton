import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import {
  ListServerExecutionJobsQueryDto,
  RetryServerExecutionJobDto,
} from './dto/server-execution-lease.dto';
import { ServerExecutorService } from './server-executor.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type AccessScope = {
  projectId?: string | null;
  environmentId?: string | null;
};

type ScopeCarrier = Record<string, unknown> & AccessScope;

type ReadableExecutionJob = {
  id: string;
  inputSnapshot?: unknown;
  metadata?: unknown;
  deploymentRuns?: ScopeCarrier[];
  siteSyncRuns?: ScopeCarrier[];
  resourceActionRuns?: (ScopeCarrier & { resource?: AccessScope | null })[];
  applicationServiceOperationRuns?: ScopeCarrier[];
  backupRuns?: ScopeCarrier[];
  logCollectionRuns?: ScopeCarrier[];
};

@Controller('server-execution-jobs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ServerExecutionJobController {
  constructor(
    private readonly serverExecutorService: ServerExecutorService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListServerExecutionJobsQueryDto,
  ) {
    const jobs = await this.serverExecutorService.listJobs(req.teamId, query);
    return this.filterReadableJobs(req, jobs);
  }

  @Post('process-next')
  @Roles('team_admin')
  processNext(@Request() req: AuthRequest) {
    return this.serverExecutorService.processNextQueuedJob(req.teamId);
  }

  @Post('recover-stale')
  @Roles('team_admin')
  recoverStale(@Request() req: AuthRequest) {
    return this.serverExecutorService.recoverStaleRunningJobs(req.teamId);
  }

  @Post(':id/cancel')
  @Roles('team_admin')
  cancel(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.serverExecutorService.cancelJob(req.teamId, req.user.id, id);
  }

  @Post(':id/retry')
  @Roles('team_admin')
  retry(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RetryServerExecutionJobDto,
  ) {
    return this.serverExecutorService.retryJob(req.teamId, req.user.id, id, dto);
  }

  private async filterReadableJobs<T extends ReadableExecutionJob>(
    req: AuthRequest,
    jobs: T[],
  ) {
    const allowed = await Promise.all(jobs.map(async (job) => ({
      job,
      allowed: await this.canReadAnyScope(
        req,
        job.id,
        this.getJobAccessScopes(job),
      ),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.job);
  }

  private async canReadAnyScope(
    req: AuthRequest,
    targetId: string,
    scopes: AccessScope[],
  ) {
    const candidates = scopes.length > 0 ? scopes : [{ projectId: null, environmentId: null }];
    for (const scope of candidates) {
      const allowed = await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: scope.projectId ?? null,
        environmentId: scope.environmentId ?? null,
        category: 'execution',
        action: 'server_execution_job.read',
        targetType: 'server_execution_job',
        targetId,
        risk: 'low',
      });
      if (allowed) return true;
    }
    return false;
  }

  private getJobAccessScopes(job: ReadableExecutionJob) {
    const scopes: AccessScope[] = [];
    this.addScopes(scopes, job.deploymentRuns);
    this.addScopes(scopes, job.siteSyncRuns);
    this.addScopes(scopes, job.applicationServiceOperationRuns);
    this.addScopes(scopes, job.backupRuns);
    this.addScopes(scopes, job.logCollectionRuns);
    this.addScopes(scopes, job.resourceActionRuns?.map((run) => run.resource ?? run));
    this.addScope(scopes, this.getJsonAccessScope(job.inputSnapshot));
    this.addScope(scopes, this.getJsonAccessScope(job.metadata));
    return this.uniqueScopes(scopes);
  }

  private addScopes(scopes: AccessScope[], values?: AccessScope[]) {
    values?.forEach((value) => this.addScope(scopes, value));
  }

  private addScope(scopes: AccessScope[], scope?: AccessScope | null) {
    if (!scope?.projectId && !scope?.environmentId) return;
    scopes.push({
      projectId: scope.projectId ?? null,
      environmentId: scope.environmentId ?? null,
    });
  }

  private getJsonAccessScope(value: unknown): AccessScope {
    const record = this.asRecord(value);
    const metadata = this.asRecord(record?.metadata);
    const sourceMetadata = this.asRecord(record?.sourceMetadata) || this.asRecord(metadata?.sourceMetadata);
    return {
      projectId: this.readString(metadata?.projectId) || this.readString(sourceMetadata?.projectId),
      environmentId: this.readString(metadata?.environmentId) || this.readString(sourceMetadata?.environmentId),
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

  private uniqueScopes(scopes: AccessScope[]) {
    const seen = new Set<string>();
    return scopes.filter((scope) => {
      const key = `${scope.projectId || ''}:${scope.environmentId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
