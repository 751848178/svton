import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { BackupRestoreService } from './backup-restore.service';
import { BackupService } from './backup.service';
import {
  CreateBackupPlanDto,
  ListBackupPlansQueryDto,
  ListBackupRunsQueryDto,
  RestoreBackupRunDto,
  RunBackupPlanDto,
  UpdateBackupPlanDto,
} from './dto/backup.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableBackupRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

@Controller('backups')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupRestoreService: BackupRestoreService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get('plans')
  async listPlans(
    @Request() req: AuthRequest,
    @Query() query: ListBackupPlansQueryDto,
  ) {
    const plans = await this.backupService.listPlans(req.teamId, query);
    return this.filterReadableBackupRecords(req, plans, 'backup_plan.read', 'backup_plan');
  }

  @Post('plans')
  async createPlan(
    @Request() req: AuthRequest,
    @Body() dto: CreateBackupPlanDto,
  ) {
    const scope = await this.backupService.resolvePlanCreateAccessScope(req.teamId, dto);
    await this.assertCanWriteBackup(req, 'backup.plan.create', dto.resourceId, scope.projectId, scope.environmentId, 'medium');
    return this.backupService.createPlan(req.teamId, req.user.id, dto);
  }

  @Put('plans/:planId')
  async updatePlan(
    @Request() req: AuthRequest,
    @Param('planId') planId: string,
    @Body() dto: UpdateBackupPlanDto,
  ) {
    const scope = await this.backupService.getPlanAccessScope(req.teamId, planId);
    await this.assertCanWriteBackup(req, 'backup.plan.update', planId, scope.projectId, scope.environmentId, 'medium');
    return this.backupService.updatePlan(req.teamId, planId, dto);
  }

  @Post('plans/:planId/runs')
  async runPlan(
    @Request() req: AuthRequest,
    @Param('planId') planId: string,
    @Body() dto: RunBackupPlanDto,
  ) {
    const scope = await this.backupService.getPlanAccessScope(req.teamId, planId);
    await this.assertCanWriteBackup(
      req,
      'backup.run',
      planId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.backupService.runPlan(req.teamId, req.user.id, planId, dto);
  }

  @Get('runs')
  async listRuns(
    @Request() req: AuthRequest,
    @Query() query: ListBackupRunsQueryDto,
  ) {
    const runs = await this.backupService.listRuns(req.teamId, query);
    return this.filterReadableBackupRecords(req, runs, 'backup_run.read', 'backup_run');
  }

  @Post('runs/:runId/restore')
  async restoreRun(
    @Request() req: AuthRequest,
    @Param('runId') runId: string,
    @Body() dto: RestoreBackupRunDto,
  ) {
    const scope = await this.backupRestoreService.getRestoreAccessScope(req.teamId, runId);
    await this.assertCanWriteBackup(
      req,
      'backup.restore',
      runId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
    );
    return this.backupRestoreService.restoreRun(req.teamId, req.user.id, runId, dto);
  }

  private assertCanWriteBackup(
    req: AuthRequest,
    action: string,
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
      category: 'backup',
      action,
      targetType: action === 'backup.plan.create' || action === 'backup.plan.update' ? 'backup_plan' : 'backup_run',
      targetId,
      risk,
    });
  }

  private async filterReadableBackupRecords<T extends ReadableBackupRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => ({
      record,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: record.projectId,
        environmentId: record.environmentId,
        category: 'backup',
        action,
        targetType,
        targetId: record.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }
}
