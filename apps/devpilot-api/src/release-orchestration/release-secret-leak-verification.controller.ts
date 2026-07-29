import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifyReleaseSecretLeaksDto } from './dto/release-secret-leak-verification.dto';
import { ReleaseSecretLeakVerificationService } from './release-secret-leak-verification.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

/** 发布计划持久化零泄漏验证入口；秘密探针不进入响应或审计。 */
@Controller('release-plans')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_admin')
export class ReleaseSecretLeakVerificationController {
  constructor(private readonly service: ReleaseSecretLeakVerificationService) {}

  @Post(':id/secret-leak-verification')
  verify(
    @Request() req: AuthRequest,
    @Param('id') planId: string,
    @Body() dto: VerifyReleaseSecretLeaksDto,
  ) {
    return this.service.verify({
      teamId: req.teamId,
      actorId: req.user.id,
      planId,
      candidateSecrets: dto.candidateSecrets,
      reason: dto.reason,
    });
  }
}
