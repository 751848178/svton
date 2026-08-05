import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseOrderEvidenceQueryDto } from "./dto/release-order-evidence-query.dto";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderEvidenceService } from "./release-order-evidence.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases/:releaseOrderId/evidence")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseOrderEvidenceController {
  constructor(
    private readonly evidence: ReleaseOrderEvidenceService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, X-Team-Id, Cookie")
  async get(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
    @Query() query: ReleaseOrderEvidenceQueryDto,
  ) {
    await this.access.assertRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    });
    return this.evidence.get(
      req.teamId,
      projectId,
      releaseOrderId,
      normalizeTake(query.take),
    );
  }
}

function normalizeTake(value: number) {
  const take = Number(value);
  return Number.isInteger(take) && take >= 1 && take <= 50 ? take : 50;
}
