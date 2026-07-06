import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorBackupRunSyncService } from "./server-executor-backup-run-sync.service";
import { ServerExecutorDeploymentRunSyncService } from "./server-executor-deployment-run-sync.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import { ServerExecutorLogCollectionRunSyncService } from "./server-executor-log-collection-run-sync.service";
import { ServerExecutorResourceActionRunSyncService } from "./server-executor-resource-action-run-sync.service";
import { ServerExecutorServiceOperationRunSyncService } from "./server-executor-service-operation-run-sync.service";
import { ServerExecutorSiteRunSyncService } from "./server-executor-site-run-sync.service";
import { ServerExecutorSiteTlsFollowUpService } from "./server-executor-site-tls-follow-up.service";
import { ServerExecutorSiteTlsProbeQueueService } from "./server-executor-site-tls-probe-queue.service";
import {
  ServerExecutionInput,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type LinkedSyncLogger = {
  warn(message: string): void;
  error(message: string): void;
};

type QueueLinkedSiteExecution = (
  input: ServerExecutionInput,
  options?: { maxAttempts?: number; availableAt?: Date },
) => Promise<ServerQueuedExecutionResult>;

export class ServerExecutorLinkedBusinessRunSyncFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
    private readonly logger: LinkedSyncLogger,
    private readonly queueLinkedSiteExecution: QueueLinkedSiteExecution,
  ) {}

  create() {
    const siteTlsFollowUpService = new ServerExecutorSiteTlsFollowUpService(
      this.prisma,
      new ServerExecutorSiteTlsProbeQueueService(this.prisma, this.logger),
    );

    return new ServerExecutorLinkedBusinessRunSyncService(
      this.prisma,
      new ServerExecutorDeploymentRunSyncService(this.prisma),
      new ServerExecutorSiteRunSyncService(this.prisma, siteTlsFollowUpService),
      new ServerExecutorResourceActionRunSyncService(this.prisma),
      new ServerExecutorServiceOperationRunSyncService(this.prisma),
      new ServerExecutorBackupRunSyncService(this.prisma),
      new ServerExecutorLogCollectionRunSyncService(
        this.prisma,
        this.logCollectionIngestionService,
      ),
      this.queueLinkedSiteExecution,
    );
  }
}
