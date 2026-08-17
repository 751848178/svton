import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event/audit-event.service';
import { redactRepositoryValue } from './repository-analysis-redact.utils';

export interface RepositoryAuditInput {
  teamId: string;
  userId?: string | null;
  projectId: string;
  action: string;
  targetType: 'repository_connection' | 'repository_analysis_run' | 'repository_identity';
  targetId?: string;
  status?: 'completed' | 'failed' | 'running' | 'blocked';
  summary: string;
  risk?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RepositoryAnalysisAuditService {
  constructor(private readonly audit: AuditEventService) {}

  record(input: RepositoryAuditInput, tx?: Prisma.TransactionClient) {
    return this.audit.create({
      teamId: input.teamId,
      actorId: input.userId,
      projectId: input.projectId,
      category: 'repository_analysis',
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      risk: input.risk || 'low',
      status: input.status || 'completed',
      summary: input.summary,
      metadata: redactRepositoryValue(input.metadata || {}) as Record<string, unknown>,
    }, tx);
  }
}
