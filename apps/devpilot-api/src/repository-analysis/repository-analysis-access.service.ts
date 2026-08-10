import { Injectable } from '@nestjs/common';
import { ControlAccessPolicyService } from '../control-access-policy';

interface RepositoryAccessInput {
  teamId: string;
  userId: string;
  projectId: string;
  action: string;
  targetType: 'repository_connection' | 'repository_analysis_run' | 'repository_identity';
  targetId?: string;
  risk?: 'low' | 'medium' | 'high';
}

@Injectable()
export class RepositoryAnalysisAccessService {
  constructor(private readonly policies: ControlAccessPolicyService) {}

  assertRead(input: RepositoryAccessInput) {
    return this.policies.assertCanRead({
      teamId: input.teamId,
      actorId: input.userId,
      projectId: input.projectId,
      category: 'repository_analysis',
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      risk: input.risk || 'low',
    });
  }

  assertWrite(input: RepositoryAccessInput) {
    return this.policies.assertCanWrite({
      teamId: input.teamId,
      actorId: input.userId,
      projectId: input.projectId,
      category: 'repository_analysis',
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      risk: input.risk || 'medium',
    });
  }
}
