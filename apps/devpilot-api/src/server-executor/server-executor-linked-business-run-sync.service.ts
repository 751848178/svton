import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorBackupRunSyncService } from "./server-executor-backup-run-sync.service";
import { ServerExecutorDeploymentRunSyncService } from "./server-executor-deployment-run-sync.service";
import { ServerExecutorLogCollectionRunSyncService } from "./server-executor-log-collection-run-sync.service";
import { ServerExecutorResourceActionRunSyncService } from "./server-executor-resource-action-run-sync.service";
import { ServerExecutorServiceOperationRunSyncService } from "./server-executor-service-operation-run-sync.service";
import { ServerExecutorSiteRunSyncService } from "./server-executor-site-run-sync.service";
import { isRecord, readOptionalString } from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type QueueSiteRunExecution = (
  input: ServerExecutionInput,
  options?: { maxAttempts?: number; availableAt?: Date },
) => Promise<ServerQueuedExecutionResult>;

export class ServerExecutorLinkedBusinessRunSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentRunSyncService: ServerExecutorDeploymentRunSyncService,
    private readonly siteRunSyncService: ServerExecutorSiteRunSyncService,
    private readonly resourceActionRunSyncService: ServerExecutorResourceActionRunSyncService,
    private readonly serviceOperationRunSyncService: ServerExecutorServiceOperationRunSyncService,
    private readonly backupRunSyncService: ServerExecutorBackupRunSyncService,
    private readonly logCollectionRunSyncService: ServerExecutorLogCollectionRunSyncService,
    private readonly queueSiteRunExecution: QueueSiteRunExecution,
  ) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
  ) {
    const metadata = this.readMetadata(input);
    const synced = await this.syncLinkedExecution(
      input,
      jobId,
      result,
      metadata,
    );
    if (synced && result.status !== "blocked") {
      await this.consumeLinkedApproval(input.teamId, metadata);
    }
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
  ) {
    const metadata = this.readMetadata(input);
    const businessRunSync = readOptionalString(metadata.businessRunSync);

    switch (businessRunSync) {
      case "deployment":
        await this.deploymentRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
        return;
      case "site_sync":
        await this.siteRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
        return;
      case "resource_action":
        await this.resourceActionRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
        return;
      case "service_operation":
        await this.serviceOperationRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
        return;
      case "backup_run":
        await this.backupRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
        return;
      case "log_collection":
        await this.logCollectionRunSyncService.syncAfterFailure(
          input,
          jobId,
          error,
          metadata,
        );
    }
  }

  private async syncLinkedExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const businessRunSync = readOptionalString(metadata.businessRunSync);

    switch (businessRunSync) {
      case "deployment":
        return this.deploymentRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
        );
      case "site_sync":
        return this.siteRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
          this.queueSiteRunExecution,
        );
      case "resource_action":
        return this.resourceActionRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
        );
      case "service_operation":
        return this.serviceOperationRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
        );
      case "backup_run":
        await this.backupRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
        );
        return false;
      case "log_collection":
        await this.logCollectionRunSyncService.syncAfterExecution(
          input,
          jobId,
          result,
          metadata,
        );
    }

    return false;
  }

  private async consumeLinkedApproval(
    teamId: string,
    metadata: Record<string, unknown>,
  ) {
    const approvalId = readOptionalString(metadata.operationApprovalId);
    if (!approvalId) {
      return;
    }

    await this.prisma.operationApproval.updateMany({
      where: {
        id: approvalId,
        teamId,
        status: "approved",
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }

  private readMetadata(input: ServerExecutionInput) {
    return isRecord(input.metadata) ? input.metadata : {};
  }
}
