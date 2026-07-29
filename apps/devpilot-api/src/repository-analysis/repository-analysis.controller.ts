import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplyRepositorySuggestionsDto, StartRepositoryAnalysisDto } from './dto/repository-analysis.dto';
import { ConnectRepositoryDto } from './dto/repository-connection.dto';
import { RepositoryAnalysisAccessService } from './repository-analysis-access.service';
import { RepositoryAnalysisRunService } from './repository-analysis-run.service';
import { RepositoryConnectionService } from './repository-connection.service';
import { RepositorySuggestionApplyService } from './repository-suggestion-apply.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('projects/:projectId/repository-analysis')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class RepositoryAnalysisController {
  constructor(
    private readonly access: RepositoryAnalysisAccessService,
    private readonly connections: RepositoryConnectionService,
    private readonly runs: RepositoryAnalysisRunService,
    private readonly applyService: RepositorySuggestionApplyService,
  ) {}

  @Get()
  async state(@Request() req: AuthRequest, @Param('projectId') projectId: string) {
    await this.assertRead(req, projectId, 'repository.read');
    return this.connections.getState(req.teamId, req.user.id, projectId);
  }

  @Post('connect')
  async connect(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: ConnectRepositoryDto,
  ) {
    await this.assertWrite(req, projectId, 'repository.connect', 'repository_connection');
    return this.connections.connect(req.teamId, req.user.id, projectId, dto);
  }

  @Get('runs')
  async listRuns(@Request() req: AuthRequest, @Param('projectId') projectId: string) {
    await this.assertRead(req, projectId, 'repository.analysis.list');
    return this.runs.list(req.teamId, projectId);
  }

  @Post('runs')
  async startRun(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: StartRepositoryAnalysisDto,
  ) {
    await this.assertWrite(req, projectId, 'repository.analysis.start', 'repository_analysis_run');
    return this.runs.start(req.teamId, req.user.id, projectId, dto);
  }

  @Get('runs/:runId')
  async runDetail(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    await this.assertRead(req, projectId, 'repository.analysis.read', runId);
    return this.runs.detail(req.teamId, projectId, runId);
  }

  @Post('runs/:runId/retry')
  async retry(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    await this.assertWrite(req, projectId, 'repository.analysis.retry', 'repository_analysis_run', runId);
    return this.runs.retry(req.teamId, req.user.id, projectId, runId);
  }

  @Post('runs/:runId/cancel')
  async cancel(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    await this.assertWrite(req, projectId, 'repository.analysis.cancel', 'repository_analysis_run', runId);
    return this.runs.cancel(req.teamId, req.user.id, projectId, runId);
  }

  @Post('runs/:runId/apply')
  async apply(
    @Request() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() dto: ApplyRepositorySuggestionsDto,
  ) {
    await this.assertWrite(req, projectId, 'repository.suggestions.apply', 'repository_analysis_run', runId);
    return this.applyService.apply(req.teamId, req.user.id, projectId, runId, dto);
  }

  private assertRead(req: AuthRequest, projectId: string, action: string, targetId?: string) {
    return this.access.assertRead({
      teamId: req.teamId,
      userId: req.user.id,
      projectId,
      action,
      targetType: targetId ? 'repository_analysis_run' : 'repository_connection',
      targetId,
    });
  }

  private assertWrite(
    req: AuthRequest,
    projectId: string,
    action: string,
    targetType: 'repository_connection' | 'repository_analysis_run',
    targetId?: string,
  ) {
    return this.access.assertWrite({
      teamId: req.teamId,
      userId: req.user.id,
      projectId,
      action,
      targetType,
      targetId,
      risk: 'medium',
    });
  }
}
