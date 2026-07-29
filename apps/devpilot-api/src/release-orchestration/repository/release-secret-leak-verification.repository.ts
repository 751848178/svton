import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ReleaseSecretLeakScope,
  SecretLeakScannableRecord,
} from '../release-secret-leak-verification.types';

/** 读取单个发布计划关联的原始持久化证据，供只读秘密扫描使用。 */
@Injectable()
export class ReleaseSecretLeakVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(teamId: string, planId: string): Promise<ReleaseSecretLeakScope | null> {
    const plan = await this.prisma.releasePlan.findFirst({
      where: { id: planId, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        stages: {
          select: {
            attempts: {
              select: { deploymentRunId: true, serverExecutionJobId: true },
            },
          },
        },
      },
    });
    if (!plan) return null;
    const attempts = plan.stages.flatMap((stage) => stage.attempts);
    const deploymentRunIds = unique(attempts.map((attempt) => attempt.deploymentRunId));
    const jobIds = unique(attempts.map((attempt) => attempt.serverExecutionJobId));
    const [runs, jobs, streams, entries, audits] = await Promise.all([
      this.loadDeploymentRuns(teamId, deploymentRunIds),
      this.loadExecutionJobs(teamId, jobIds),
      this.loadLogStreams(teamId, deploymentRunIds),
      this.loadLogEntries(teamId, deploymentRunIds),
      this.loadAuditEvents(teamId, deploymentRunIds, jobIds),
    ]);
    return {
      planId: plan.id,
      projectId: plan.projectId,
      environmentId: plan.environmentId,
      records: [...runs, ...jobs, ...streams, ...entries, ...audits],
    };
  }

  private async loadDeploymentRuns(
    teamId: string,
    ids: string[],
  ): Promise<SecretLeakScannableRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.deploymentRun.findMany({
      where: { teamId, id: { in: ids } },
      select: {
        id: true, workingDirectory: true, buildCommand: true, deployCommand: true,
        params: true, commandPlan: true, logs: true, result: true, error: true,
      },
    });
    return rows.map(({ id, ...fields }) => ({ recordType: 'deployment_run', recordId: id, fields }));
  }

  private async loadExecutionJobs(
    teamId: string,
    ids: string[],
  ): Promise<SecretLeakScannableRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.serverExecutionJob.findMany({
      where: { teamId, id: { in: ids } },
      select: {
        id: true, inputSnapshot: true, commandPlan: true, logs: true,
        result: true, error: true, metadata: true,
      },
    });
    return rows.map(({ id, ...fields }) => ({
      recordType: 'server_execution_job',
      recordId: id,
      fields,
    }));
  }

  private async loadLogStreams(
    teamId: string,
    runIds: string[],
  ): Promise<SecretLeakScannableRecord[]> {
    if (runIds.length === 0) return [];
    const rows = await this.prisma.logStream.findMany({
      where: { teamId, deploymentRunId: { in: runIds } },
      select: { id: true, labels: true, metadata: true, lastMessage: true },
    });
    return rows.map(({ id, ...fields }) => ({
      recordType: 'deployment_log_stream',
      recordId: id,
      fields,
    }));
  }

  private async loadLogEntries(
    teamId: string,
    runIds: string[],
  ): Promise<SecretLeakScannableRecord[]> {
    if (runIds.length === 0) return [];
    const rows = await this.prisma.logEntry.findMany({
      where: { teamId, deploymentRunId: { in: runIds } },
      select: { id: true, message: true, labels: true, context: true, raw: true },
    });
    return rows.map(({ id, ...fields }) => ({
      recordType: 'deployment_log_entry',
      recordId: id,
      fields,
    }));
  }

  private async loadAuditEvents(
    teamId: string,
    runIds: string[],
    jobIds: string[],
  ): Promise<SecretLeakScannableRecord[]> {
    if (runIds.length === 0 && jobIds.length === 0) return [];
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        teamId,
        OR: [
          { deploymentRunId: { in: runIds } },
          { targetType: 'server_execution_job', targetId: { in: jobIds } },
        ],
      },
      select: { id: true, summary: true, metadata: true },
    });
    return rows.map(({ id, ...fields }) => ({
      recordType: 'execution_audit_event',
      recordId: id,
      fields,
    }));
  }
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
