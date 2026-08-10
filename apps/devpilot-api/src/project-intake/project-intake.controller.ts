import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { StartRepositoryAnalysisDto } from "../repository-analysis/dto/repository-analysis.dto";
import { ConnectRepositoryDto } from "../repository-analysis/dto/repository-connection.dto";
import {
  CreateProjectIntakeDraftDto,
  FinalizeProjectIntakeDto,
} from "./dto/project-intake.dto";
import { ReviewRepositoryIntakeContractDto } from "./dto/repository-intake-review.dto";
import { ProjectIntakeAccessService } from "./project-intake-access.service";
import { ProjectIntakeService } from "./project-intake.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("project-intake")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ProjectIntakeController {
  constructor(
    private readonly intake: ProjectIntakeService,
    private readonly access: ProjectIntakeAccessService,
  ) {}

  @Get("credential-options")
  async credentialOptions(@Request() req: AuthRequest) {
    await this.access.assertCreate(this.scope(req));
    return this.intake.credentialOptions(req.teamId, req.user.id);
  }

  @Post("drafts")
  async createDraft(
    @Request() req: AuthRequest,
    @Body() dto: CreateProjectIntakeDraftDto,
  ) {
    await this.access.assertCreate(this.scope(req));
    return this.intake.createDraft(req.teamId, req.user.id, dto);
  }

  @Get(":projectId")
  async state(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead(this.projectScope(req, projectId));
    return this.intake.state(req.teamId, req.user.id, projectId);
  }

  @Post(":projectId/repository")
  async connect(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: ConnectRepositoryDto,
  ) {
    await this.access.assertWrite(
      this.projectScope(req, projectId),
      "project.intake.repository.connect",
    );
    return this.intake.connect(req.teamId, req.user.id, projectId, dto);
  }

  @Post(":projectId/analysis-runs")
  async startAnalysis(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: StartRepositoryAnalysisDto,
  ) {
    await this.access.assertWrite(
      this.projectScope(req, projectId),
      "project.intake.analysis.start",
    );
    return this.intake.startAnalysis(req.teamId, req.user.id, projectId, dto);
  }

  @Post(":projectId/analysis-runs/:runId/retry")
  async retryAnalysis(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("runId") runId: string,
  ) {
    await this.access.assertWrite(
      this.projectScope(req, projectId),
      "project.intake.analysis.retry",
    );
    return this.intake.retryAnalysis(req.teamId, req.user.id, projectId, runId);
  }

  @Post(":projectId/analysis-runs/:runId/review")
  async review(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("runId") runId: string,
    @Body() dto: ReviewRepositoryIntakeContractDto,
  ) {
    await this.access.assertWrite(
      this.projectScope(req, projectId),
      "project.intake.analysis.review",
    );
    return this.intake.review(req.teamId, req.user.id, projectId, runId, dto);
  }

  @Get(":projectId/analysis-runs/:runId/contract")
  async contract(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("runId") runId: string,
  ) {
    await this.access.assertRead(this.projectScope(req, projectId));
    return this.intake.contract(req.teamId, projectId, runId);
  }

  @Post(":projectId/finalize")
  async finalize(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: FinalizeProjectIntakeDto,
  ) {
    await this.access.assertWrite(
      this.projectScope(req, projectId),
      "project.intake.finalize",
    );
    return this.intake.finalize(req.teamId, req.user.id, projectId, dto);
  }

  private scope(req: AuthRequest) {
    return { teamId: req.teamId, actorId: req.user.id };
  }

  private projectScope(req: AuthRequest, projectId: string) {
    return { ...this.scope(req), projectId };
  }
}
