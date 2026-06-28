-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `logStreamId` VARCHAR(191) NULL,
    ADD COLUMN `logEntryId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `LogStream` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `deploymentRunId` VARCHAR(191) NULL,
    `backupPlanId` VARCHAR(191) NULL,
    `backupRunId` VARCHAR(191) NULL,
    `alertEventId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `sourceKey` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `retentionDays` INTEGER NOT NULL DEFAULT 14,
    `labels` JSON NULL,
    `metadata` JSON NULL,
    `lastEntryAt` DATETIME(3) NULL,
    `lastLevel` VARCHAR(191) NULL,
    `lastMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogEntry` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `streamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `deploymentRunId` VARCHAR(191) NULL,
    `backupPlanId` VARCHAR(191) NULL,
    `backupRunId` VARCHAR(191) NULL,
    `alertEventId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `level` VARCHAR(191) NOT NULL DEFAULT 'info',
    `message` TEXT NOT NULL,
    `source` VARCHAR(191) NULL,
    `labels` JSON NULL,
    `context` JSON NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_logStreamId_idx` ON `AuditEvent`(`logStreamId`);
CREATE INDEX `AuditEvent_logEntryId_idx` ON `AuditEvent`(`logEntryId`);
CREATE INDEX `LogStream_teamId_idx` ON `LogStream`(`teamId`);
CREATE INDEX `LogStream_createdById_idx` ON `LogStream`(`createdById`);
CREATE INDEX `LogStream_projectId_idx` ON `LogStream`(`projectId`);
CREATE INDEX `LogStream_environmentId_idx` ON `LogStream`(`environmentId`);
CREATE INDEX `LogStream_applicationId_idx` ON `LogStream`(`applicationId`);
CREATE INDEX `LogStream_applicationServiceId_idx` ON `LogStream`(`applicationServiceId`);
CREATE INDEX `LogStream_serverId_idx` ON `LogStream`(`serverId`);
CREATE INDEX `LogStream_siteId_idx` ON `LogStream`(`siteId`);
CREATE INDEX `LogStream_managedResourceId_idx` ON `LogStream`(`managedResourceId`);
CREATE INDEX `LogStream_deploymentRunId_idx` ON `LogStream`(`deploymentRunId`);
CREATE INDEX `LogStream_backupPlanId_idx` ON `LogStream`(`backupPlanId`);
CREATE INDEX `LogStream_backupRunId_idx` ON `LogStream`(`backupRunId`);
CREATE INDEX `LogStream_alertEventId_idx` ON `LogStream`(`alertEventId`);
CREATE INDEX `LogStream_sourceType_idx` ON `LogStream`(`sourceType`);
CREATE INDEX `LogStream_sourceKey_idx` ON `LogStream`(`sourceKey`);
CREATE INDEX `LogStream_status_idx` ON `LogStream`(`status`);
CREATE INDEX `LogStream_lastEntryAt_idx` ON `LogStream`(`lastEntryAt`);
CREATE INDEX `LogEntry_teamId_idx` ON `LogEntry`(`teamId`);
CREATE INDEX `LogEntry_streamId_idx` ON `LogEntry`(`streamId`);
CREATE INDEX `LogEntry_actorId_idx` ON `LogEntry`(`actorId`);
CREATE INDEX `LogEntry_projectId_idx` ON `LogEntry`(`projectId`);
CREATE INDEX `LogEntry_environmentId_idx` ON `LogEntry`(`environmentId`);
CREATE INDEX `LogEntry_applicationId_idx` ON `LogEntry`(`applicationId`);
CREATE INDEX `LogEntry_applicationServiceId_idx` ON `LogEntry`(`applicationServiceId`);
CREATE INDEX `LogEntry_serverId_idx` ON `LogEntry`(`serverId`);
CREATE INDEX `LogEntry_siteId_idx` ON `LogEntry`(`siteId`);
CREATE INDEX `LogEntry_managedResourceId_idx` ON `LogEntry`(`managedResourceId`);
CREATE INDEX `LogEntry_deploymentRunId_idx` ON `LogEntry`(`deploymentRunId`);
CREATE INDEX `LogEntry_backupPlanId_idx` ON `LogEntry`(`backupPlanId`);
CREATE INDEX `LogEntry_backupRunId_idx` ON `LogEntry`(`backupRunId`);
CREATE INDEX `LogEntry_alertEventId_idx` ON `LogEntry`(`alertEventId`);
CREATE INDEX `LogEntry_timestamp_idx` ON `LogEntry`(`timestamp`);
CREATE INDEX `LogEntry_level_idx` ON `LogEntry`(`level`);
CREATE INDEX `LogEntry_source_idx` ON `LogEntry`(`source`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_logStreamId_fkey` FOREIGN KEY (`logStreamId`) REFERENCES `LogStream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_logEntryId_fkey` FOREIGN KEY (`logEntryId`) REFERENCES `LogEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_backupPlanId_fkey` FOREIGN KEY (`backupPlanId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_backupRunId_fkey` FOREIGN KEY (`backupRunId`) REFERENCES `BackupRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogStream` ADD CONSTRAINT `LogStream_alertEventId_fkey` FOREIGN KEY (`alertEventId`) REFERENCES `AlertEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_streamId_fkey` FOREIGN KEY (`streamId`) REFERENCES `LogStream`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_backupPlanId_fkey` FOREIGN KEY (`backupPlanId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_backupRunId_fkey` FOREIGN KEY (`backupRunId`) REFERENCES `BackupRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_alertEventId_fkey` FOREIGN KEY (`alertEventId`) REFERENCES `AlertEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
