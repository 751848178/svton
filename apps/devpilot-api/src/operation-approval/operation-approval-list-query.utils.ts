import { Prisma } from '@prisma/client';
import type { ListOperationApprovalsQueryDto } from './dto/operation-approval.dto';

export function buildOperationApprovalWhere(
  teamId: string,
  query: ListOperationApprovalsQueryDto,
): Prisma.OperationApprovalWhereInput {
  const where: Prisma.OperationApprovalWhereInput = { teamId };

  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.action) where.action = query.action;
  if (query.targetType) where.targetType = query.targetType;
  if (query.risk) where.risk = query.risk;
  if (query.projectId) where.projectId = query.projectId;
  if (query.environmentId) where.environmentId = query.environmentId;
  if (query.requesterId) where.requesterId = query.requesterId;

  return where;
}
