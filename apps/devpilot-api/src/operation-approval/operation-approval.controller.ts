import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import {
  ListOperationApprovalsQueryDto,
  ReviewOperationApprovalDto,
} from './dto/operation-approval.dto';
import { OperationApprovalService } from './operation-approval.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableOperationApproval = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  risk?: string | null;
};

@Controller('operation-approvals')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class OperationApprovalController {
  constructor(
    private readonly approvalService: OperationApprovalService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListOperationApprovalsQueryDto,
  ) {
    const approvals = await this.approvalService.list(req.teamId, query);
    return this.filterReadableApprovals(req, approvals);
  }

  @Post(':id/review')
  @Roles('team_admin')
  review(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ReviewOperationApprovalDto,
  ) {
    return this.approvalService.review(req.teamId, req.user.id, id, dto);
  }

  private async filterReadableApprovals<T extends ReadableOperationApproval>(
    req: AuthRequest,
    approvals: T[],
  ) {
    const allowed = await Promise.all(approvals.map(async (approval) => ({
      approval,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: approval.projectId,
        environmentId: approval.environmentId,
        category: 'approval',
        action: 'operation_approval.read',
        targetType: 'operation_approval',
        targetId: approval.id,
        risk: approval.risk || 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.approval);
  }
}
