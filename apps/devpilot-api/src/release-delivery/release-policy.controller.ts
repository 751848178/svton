import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateReleasePolicyRevisionDto } from "./dto/release-policy.dto";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleasePolicyService } from "./release-policy.service";

interface AuthRequest { user: { id: string }; teamId: string }

@Controller("projects/:projectId/release-policy")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleasePolicyController {
  constructor(
    private readonly policies: ReleasePolicyService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
  ) {
    await this.access.assertRead(this.scope(req, projectId));
    return this.policies.get(req.teamId, projectId);
  }

  @Post()
  async create(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Body() dto: CreateReleasePolicyRevisionDto,
  ) {
    await this.access.assertManagePolicy(this.scope(req, projectId));
    return this.policies.create(req.teamId, projectId, req.user.id, dto);
  }

  private scope(req: AuthRequest, projectId: string) {
    return { teamId: req.teamId, actorId: req.user.id, projectId };
  }
}

