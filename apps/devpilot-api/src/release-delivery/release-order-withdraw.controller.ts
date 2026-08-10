import { Controller, Param, Post, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderWithdrawService } from "./release-order-withdraw.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("projects/:projectId/delivery/releases")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ReleaseOrderWithdrawController {
  constructor(
    private readonly withdrawals: ReleaseOrderWithdrawService,
    private readonly access: ReleaseOrderAccessService,
  ) {}

  @Post(":releaseOrderId/withdraw")
  async withdraw(
    @Request() req: AuthRequest,
    @Param("projectId") projectId: string,
    @Param("releaseOrderId") releaseOrderId: string,
  ) {
    const scope = {
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
    };
    await this.access.assertWithdraw(scope);
    return this.withdrawals.withdraw({ ...scope, releaseOrderId });
  }
}
