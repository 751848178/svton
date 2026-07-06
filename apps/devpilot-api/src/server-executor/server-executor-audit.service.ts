import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditEventService } from "../audit-event";
import { buildServerExecutionInputSnapshot } from "./server-executor-input-snapshot.utils";
import {
  readServerAgentDispatchCorrelation,
  readServerAgentDispatcherResponseSummary,
  readServerExecutionJobAuditScope,
} from "./server-executor-job-metadata.utils";
import {
  isRecord,
  readOptionalBoolean,
  readOptionalString,
  toJsonValue,
} from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

type ServerExecutionJobAuditJob = {
  id: string;
  teamId: string;
  actorId: string | null;
  serverId: string | null;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  retryOfId?: string | null;
  inputSnapshot: Prisma.JsonValue;
  metadata?: Prisma.JsonValue | null;
};

type ServerExecutionJobAuditOptions = {
  job: ServerExecutionJobAuditJob;
  actorId?: string;
  action: string;
  risk: string;
  status: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export class ServerExecutorAuditService {
  constructor(
    private readonly auditEventService: AuditEventService | undefined,
    private readonly logger: Pick<Logger, "warn">,
  ) {}

  async writeExecutionJobAudit(options: ServerExecutionJobAuditOptions) {
    if (!this.auditEventService) {
      return;
    }

    const scope = readServerExecutionJobAuditScope(options.job);
    await this.auditEventService.create({
      teamId: options.job.teamId,
      actorId: options.actorId ?? null,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      serverId: options.job.serverId,
      category: "execution",
      action: options.action,
      targetType: "server_execution_job",
      targetId: options.job.id,
      risk: options.risk,
      status: options.status,
      summary: options.summary,
      metadata: {
        serverExecutionJobId: options.job.id,
        originalActorId: options.job.actorId,
        operationKey: options.job.operationKey,
        adapterKey: options.job.adapterKey,
        transport: options.job.transport,
        dryRun: options.job.dryRun,
        queueMode: options.job.queueMode,
        attempt: options.job.attempt,
        maxAttempts: options.job.maxAttempts,
        retryOfId: options.job.retryOfId,
        ...options.metadata,
      },
    });
  }

  async writeServerAgentDispatchAudit(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
  ) {
    if (!this.auditEventService || input.target.transport !== "server_agent") {
      return;
    }

    const resultRecord: Record<string, unknown> = isRecord(result.result)
      ? (result.result as Record<string, unknown>)
      : {};
    const executorAdapterKey = readOptionalString(
      resultRecord.executorAdapterKey,
    );
    if (executorAdapterKey !== "server-agent") {
      return;
    }

    try {
      const metadata = isRecord(input.metadata) ? input.metadata : {};
      const scope = readServerExecutionJobAuditScope({
        inputSnapshot: buildServerExecutionInputSnapshot(input),
        metadata: toJsonValue({ sourceMetadata: metadata }),
      });
      await this.auditEventService.create({
        teamId: input.teamId,
        actorId: input.userId ?? null,
        projectId: scope.projectId,
        environmentId: scope.environmentId,
        serverId: input.target.serverId ?? undefined,
        category: "execution",
        action: "server_execution_job.agent_dispatch",
        targetType: "server_execution_job",
        targetId: jobId,
        risk: input.dryRun ? "low" : "medium",
        status: result.status,
        summary: `Server agent dispatch ${input.operationKey} ${result.status}`,
        metadata: {
          serverExecutionJobId: jobId,
          operationKey: input.operationKey,
          adapterKey: input.adapterKey,
          transport: input.target.transport,
          dryRun: input.dryRun,
          resultStatus: result.status,
          resultMode: result.mode,
          executable: result.executable,
          error: result.error,
          correlation: readServerAgentDispatchCorrelation(resultRecord),
          agentExecutorEnabled: readOptionalBoolean(
            resultRecord.agentExecutorEnabled,
          ),
          dispatcherConfigured: readOptionalBoolean(
            resultRecord.dispatcherConfigured,
          ),
          dispatcher: readOptionalString(resultRecord.dispatcher),
          nextExecutorBoundary: readOptionalString(
            resultRecord.nextExecutorBoundary,
          ),
          dispatcherResponse: readServerAgentDispatcherResponseSummary(
            resultRecord.dispatcherResponse,
          ),
          warnings: result.warnings,
        },
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Failed to write Server agent dispatch audit for job ${jobId}: ${error.message}`
          : `Failed to write Server agent dispatch audit for job ${jobId}`,
      );
    }
  }
}
