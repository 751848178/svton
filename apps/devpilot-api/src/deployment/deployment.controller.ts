import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { DeploymentService } from './deployment.service';
import {
  CreateDeploymentRunDto,
  ListDeploymentRunsQueryDto,
  RollbackDeploymentRunDto,
  RetryDeploymentRunDto,
  SmokeDeploymentRunDto,
} from './dto/deployment.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableDeploymentRun = {
  id: string;
  projectId: string;
  environmentId?: string | null;
};

@Controller('deployments')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class DeploymentController {
  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get('runs')
  async listRuns(
    @Request() req: AuthRequest,
    @Query() query: ListDeploymentRunsQueryDto,
  ) {
    const runs = await this.deploymentService.listRuns(req.teamId, query);
    return this.filterReadableDeploymentRuns(req, runs);
  }

  @Post('projects/:projectId/runs')
  async createRun(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.resolveRunCreateAccessScope(req.teamId, projectId, dto);
    await this.assertCanWriteDeployment(
      req,
      'deployment.run.create',
      'project',
      projectId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.deploymentService.createRun(
      req.teamId,
      req.user.id,
      projectId,
      dto,
    );
  }

  @Post('runs/:runId/rollback')
  async rollbackRun(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: RollbackDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.getRunAccessScope(req.teamId, runId);
    await this.assertCanWriteDeployment(
      req,
      'deployment.rollback',
      'deployment_run',
      runId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.deploymentService.rollbackRun(
      req.teamId,
      req.user.id,
      runId,
      dto,
    );
  }

  @Post('runs/:runId/failure-rollback')
  async requestFailureRollback(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: RollbackDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.getRunAccessScope(req.teamId, runId);
    await this.assertCanWriteDeployment(
      req,
      'deployment.failure_rollback',
      'deployment_run',
      runId,
      scope.projectId,
      scope.environmentId,
      'high',
    );
    return this.deploymentService.requestFailureRollback(
      req.teamId,
      req.user.id,
      runId,
      dto,
    );
  }

  @Post('runs/:runId/smoke-failure-rollback')
  async requestSmokeFailureRollback(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: RollbackDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.getRunAccessScope(req.teamId, runId);
    await this.assertCanWriteDeployment(
      req,
      'deployment.smoke_failure_rollback',
      'deployment_run',
      runId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.deploymentService.requestSmokeFailureRollback(
      req.teamId,
      req.user.id,
      runId,
      dto,
    );
  }

  @Post('runs/:runId/retry')
  async retryRun(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: RetryDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.getRunAccessScope(req.teamId, runId);
    await this.assertCanWriteDeployment(
      req,
      'deployment.retry',
      'deployment_run',
      runId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.deploymentService.retryRun(
      req.teamId,
      req.user.id,
      runId,
      dto,
    );
  }

  @Post('runs/:runId/smoke-check')
  async smokeCheckRun(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: SmokeDeploymentRunDto,
  ) {
    const scope = await this.deploymentService.getRunAccessScope(req.teamId, runId);
    await this.assertCanWriteDeployment(
      req,
      'deployment.smoke_check',
      'deployment_run',
      runId,
      scope.projectId,
      scope.environmentId,
      'low',
    );
    return this.deploymentService.smokeCheckRun(
      req.teamId,
      req.user.id,
      runId,
      dto,
    );
  }

  private assertCanWriteDeployment(
    req: AuthRequest,
    action: string,
    targetType: string,
    targetId: string,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'deployment',
      action,
      targetType,
      targetId,
      risk,
    });
  }

  private async filterReadableDeploymentRuns<T extends ReadableDeploymentRun>(
    req: AuthRequest,
    runs: T[],
  ) {
    const allowed = await Promise.all(runs.map(async (run) => ({
      run,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: run.projectId,
        environmentId: run.environmentId,
        category: 'deployment',
        action: 'deployment_run.read',
        targetType: 'deployment_run',
        targetId: run.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.run);
  }
}
