import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CollectLogStreamDto } from "./dto/log-center.dto";
import { LogCenterAuditService } from "./log-center-audit.service";
import { logCollectionRunInclude } from "./log-center-includes.constants";
import {
  isServerCollectableSource,
  normalizeLogTail,
  toJsonValue,
} from "./log-center-value.utils";
import { LogCollectionIngestionService } from "./log-collection-ingestion.service";
import {
  LogCollectionExecutionResult,
  LogProviderCollectionPlanOptions,
  LogProviderCollectionPlanStream,
} from "./log-provider-collection-plan.types";
import { LogProviderCollectionPlanService } from "./log-provider-collection-plan.service";
import { LogServerCollectionExecutionService } from "./log-server-collection-execution.service";
import { LogStreamRecord } from "./log-stream-query.service";

@Injectable()
export class LogCollectionRunExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
    private readonly logCenterAuditService: LogCenterAuditService,
    private readonly logServerCollectionExecutionService: LogServerCollectionExecutionService,
    private readonly logProviderCollectionPlanService: LogProviderCollectionPlanService,
  ) {}

  async execute(
    teamId: string,
    userId: string | null,
    stream: LogStreamRecord,
    dto: CollectLogStreamDto,
  ) {
    const tail = normalizeLogTail(dto.tail);
    const dryRun = dto.dryRun ?? true;
    const queue =
      dto.queue === true && isServerCollectableSource(stream.sourceType);
    const run = await this.prisma.logCollectionRun.create({
      data: {
        teamId,
        streamId: stream.id,
        actorId: userId ?? undefined,
        projectId: stream.projectId,
        environmentId: stream.environmentId,
        applicationId: stream.applicationId,
        applicationServiceId: stream.applicationServiceId,
        serverId: stream.serverId,
        siteId: stream.siteId,
        managedResourceId: stream.managedResourceId,
        deploymentRunId: stream.deploymentRunId,
        backupPlanId: stream.backupPlanId,
        backupRunId: stream.backupRunId,
        alertEventId: stream.alertEventId,
        sourceType: stream.sourceType,
        sourceKey: stream.sourceKey,
        dryRun,
        tail,
        status: queue ? "queued" : undefined,
        params: dto.params ? toJsonValue(dto.params) : undefined,
      },
      include: logCollectionRunInclude,
    });

    const execution = await this.executeCollectionPlan(
      teamId,
      userId,
      stream,
      run.id,
      {
        dryRun,
        tail,
        queue,
        maxAttempts: dto.maxAttempts,
        confirmationText: dto.confirmationText,
        params: dto.params,
      },
    );
    const updatedRun = await this.updateRun(run.id, execution);

    if (execution.status === "completed") {
      await this.logCollectionIngestionService.ingestCompletedRun(
        teamId,
        run.id,
      );
    }

    const finalRun = await this.prisma.logCollectionRun.findFirst({
      where: { id: run.id, teamId },
      include: logCollectionRunInclude,
    });

    await this.logCenterAuditService.recordCollection(
      teamId,
      userId,
      stream,
      finalRun || updatedRun,
    );
    return finalRun || updatedRun;
  }

  executeCollectionPlan(
    teamId: string,
    userId: string | null,
    stream: LogStreamRecord,
    runId: string,
    options: LogCollectionPlanOptions,
  ): Promise<LogCollectionExecutionResult> {
    if (isServerCollectableSource(stream.sourceType)) {
      return this.logServerCollectionExecutionService.execute(
        teamId,
        userId,
        stream,
        runId,
        options,
      );
    }

    return this.logProviderCollectionPlanService.buildPlan(
      stream as LogProviderCollectionPlanStream,
      runId,
      options as LogProviderCollectionPlanOptions,
    );
  }

  private updateRun(runId: string, execution: LogCollectionExecutionResult) {
    const updateData: Prisma.LogCollectionRunUncheckedUpdateInput = {
      executorKey: execution.executorKey,
      adapterKey: execution.adapterKey,
      status: execution.status,
      commandPlan: execution.commandPlan,
      logs: execution.logs,
      result: execution.result,
      error: execution.error,
      ...(execution.serverExecutionJobId
        ? { serverExecutionJobId: execution.serverExecutionJobId }
        : {}),
      ...(execution.status === "queued" ? {} : { finishedAt: new Date() }),
    };
    return this.prisma.logCollectionRun.update({
      where: { id: runId },
      data: updateData,
      include: logCollectionRunInclude,
    });
  }
}

type LogCollectionPlanOptions = {
  dryRun: boolean;
  tail: number;
  queue?: boolean;
  maxAttempts?: number;
  confirmationText?: string;
  params?: Record<string, unknown>;
};
