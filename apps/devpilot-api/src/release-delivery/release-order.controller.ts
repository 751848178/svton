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
import { CreateReleaseOrderDto } from "./dto/release-order.dto";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderService } from "./release-order.service";

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
    private readonly builds: ReleaseBuildService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.orders.list(req.teamId, projectId);
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

  private scope(req: AuthRequest, projectId: string) {
    return { teamId: req.teamId, actorId: req.user.id, projectId };
  }
}
