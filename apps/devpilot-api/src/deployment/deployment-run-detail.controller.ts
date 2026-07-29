import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeploymentRunDetailService } from './deployment-run-detail.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

/** DeploymentRun 精确详情入口。 */
@Controller('deployments/runs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class DeploymentRunDetailController {
  constructor(private readonly service: DeploymentRunDetailService) {}

  @Get(':id')
  get(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.service.get({
      teamId: req.teamId,
      actorId: req.user.id,
      runId: id,
    });
  }
}
