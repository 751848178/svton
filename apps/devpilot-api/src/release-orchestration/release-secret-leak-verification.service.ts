import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ReleaseSecretLeakVerificationRepository } from './repository/release-secret-leak-verification.repository';
import type { ReleaseSecretLeakVerificationResult } from './release-secret-leak-verification.types';
import {
  normalizeCandidateSecrets,
  scanSecretLeakRecords,
} from './utils/secret-leak-detector.utils';

interface VerifyInput {
  teamId: string;
  actorId: string;
  planId: string;
  candidateSecrets?: string[];
  reason?: string;
}

/** 编排计划级零泄漏扫描、访问策略和无秘密审计记录。 */
@Injectable()
export class ReleaseSecretLeakVerificationService {
  constructor(
    private readonly repository: ReleaseSecretLeakVerificationRepository,
    private readonly accessPolicy: ControlAccessPolicyService,
    private readonly auditEvents: AuditEventService,
  ) {}

  async verify(input: VerifyInput): Promise<ReleaseSecretLeakVerificationResult> {
    let scope;
    try {
      scope = await this.repository.load(input.teamId, input.planId);
    } catch {
      await this.recordFailure(input);
      throw new InternalServerErrorException('零泄漏验证失败，未生成通过结论');
    }
    if (!scope) throw new NotFoundException('发布计划不存在');
    await this.accessPolicy.assertCanWrite({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'release_plan',
      action: 'release_plan.secret_leak.verify',
      targetType: 'release_plan',
      targetId: scope.planId,
      risk: 'high',
    });
    try {
      const candidates = normalizeCandidateSecrets(input.candidateSecrets);
      const findings = scanSecretLeakRecords(scope.records, candidates);
      const scannedFieldCount = scope.records.reduce(
        (total, record) => total + Object.keys(record.fields).length,
        0,
      );
      const audit = await this.auditEvents.create({
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: scope.projectId,
        environmentId: scope.environmentId,
        category: 'release_plan',
        action: 'release_plan.secret_leak.verified',
        targetType: 'release_plan',
        targetId: scope.planId,
        risk: 'high',
        status: 'completed',
        summary: findings.length === 0
          ? '发布计划持久化零泄漏验证通过'
          : `发布计划持久化零泄漏验证发现 ${findings.length} 处命中`,
        metadata: {
          verdict: findings.length === 0 ? 'clean' : 'leak_detected',
          coverageComplete: true,
          candidateCount: candidates.length,
          scannedRecordCount: scope.records.length,
          scannedFieldCount,
          findingCount: findings.length,
          reasonProvided: Boolean(input.reason?.trim()),
          detectors: [...new Set(findings.map((finding) => finding.detector))],
        },
      });
      return {
        planId: scope.planId,
        verdict: findings.length === 0 ? 'clean' : 'leak_detected',
        coverageComplete: true,
        candidateCount: candidates.length,
        scannedRecordCount: scope.records.length,
        scannedFieldCount,
        findingCount: findings.length,
        findings,
        auditEventId: audit.id,
      };
    } catch {
      await this.recordFailure(input, scope.projectId, scope.environmentId);
      throw new InternalServerErrorException('零泄漏验证失败，未生成通过结论');
    }
  }

  private async recordFailure(
    input: VerifyInput,
    projectId?: string,
    environmentId?: string,
  ): Promise<void> {
    await this.auditEvents.create({
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: projectId ?? null,
      environmentId: environmentId ?? null,
      category: 'release_plan',
      action: 'release_plan.secret_leak.verification_failed',
      targetType: 'release_plan',
      targetId: input.planId,
      risk: 'high',
      status: 'failed',
      summary: '发布计划持久化零泄漏验证失败',
      metadata: { coverageComplete: false },
    });
  }
}
