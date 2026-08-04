import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateReleaseOrderDto } from "./dto/release-order.dto";
import { ReleaseOrderListQueryDto } from "./dto/release-order-list-query.dto";
import { DeployReleaseToStagingDto } from "./dto/release-staging.dto";
import {
  ConfirmProductionReleaseDto,
  ProductionReleasePreviewDto,
} from "./dto/release-production.dto";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseStagingService } from "./release-staging.service";
import { ReleaseProductionService } from "./release-production.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderService } from "./release-order.service";
import { ReleaseOrderListService } from "./release-order-list.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseOrderController {
  constructor(
    private readonly orders: ReleaseOrderService,
    private readonly orderList: ReleaseOrderListService,
    private readonly builds: ReleaseBuildService,
    private readonly staging: ReleaseStagingService,
    private readonly production: ReleaseProductionService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, X-Team-Id, Cookie")
  async list(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Query() query: ReleaseOrderListQueryDto,
  ) {
    const scope = this.scope(req, projectId);
    await this.access.assertRead(scope);
    return this.orderList.list(scope.teamId, scope.actorId, projectId, query);
  }

  @Post()
  async create(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: CreateReleaseOrderDto,
  ) {
    await this.access.assertCreate(this.scope(req, projectId));
    return this.orders.create(req.teamId, req.user.id, projectId, dto);
  }

  @Get(":releaseOrderId")
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.orders.get(req.teamId, projectId, releaseOrderId);
  }

  @Get(":releaseOrderId/builds")
  async listBuilds(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.builds.list(req.teamId, projectId, releaseOrderId);
  }

  @Post(":releaseOrderId/builds")
  async build(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertBuild(this.scope(req, projectId));
    return this.builds.build(
      req.teamId,
      req.user.id,
      projectId,
      releaseOrderId,
    );
  }

  @Get(":releaseOrderId/staging-deployments")
  async listStagingDeployments(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.staging.list(req.teamId, projectId, releaseOrderId);
  }

  @Post(":releaseOrderId/staging-deployments")
  async deployStaging(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Body() dto: DeployReleaseToStagingDto,
  ) {
    await this.access.assertDeployStaging(this.scope(req, projectId));
    return this.staging.deploy({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      releaseOrderId,
      manifestId: dto.manifestId,
    });
  }

  @Get(":releaseOrderId/production-releases")
  async listProduction(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.production.list(req.teamId, projectId, releaseOrderId);
  }

  @Get(":releaseOrderId/production-preview")
  async previewProduction(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Query() query: ProductionReleasePreviewDto,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.production.preview(
      req.teamId,
      projectId,
      releaseOrderId,
      query.manifestId,
      query.strategy,
    );
  }

  @Post(":releaseOrderId/production-releases")
  async confirmProduction(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Body() dto: ConfirmProductionReleaseDto,
  ) {
    await this.access.assertConfirmProduction(this.scope(req, projectId));
    return this.production.confirm({
      ...dto,
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      releaseOrderId,
    });
  }

  private scope(req: AuthRequest, projectId: string) {
    return { teamId: req.teamId, actorId: req.user.id, projectId };
  }
}
