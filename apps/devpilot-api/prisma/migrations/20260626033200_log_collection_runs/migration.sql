-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `logCollectionRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `LogCollectionRun` (
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
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceKey` VARCHAR(191) NULL,
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'server-executor',
    `adapterKey` VARCHAR(191) NOT NULL DEFAULT 'log-collection-plan',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `tail` INTEGER NOT NULL DEFAULT 200,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `params` JSON NULL,
    `commandPlan` JSON NULL,
    `logs` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_logCollectionRunId_idx` ON `AuditEvent`(`logCollectionRunId`);
CREATE INDEX `LogCollectionRun_teamId_idx` ON `LogCollectionRun`(`teamId`);
CREATE INDEX `LogCollectionRun_streamId_idx` ON `LogCollectionRun`(`streamId`);
CREATE INDEX `LogCollectionRun_actorId_idx` ON `LogCollectionRun`(`actorId`);
CREATE INDEX `LogCollectionRun_projectId_idx` ON `LogCollectionRun`(`projectId`);
CREATE INDEX `LogCollectionRun_environmentId_idx` ON `LogCollectionRun`(`environmentId`);
CREATE INDEX `LogCollectionRun_applicationId_idx` ON `LogCollectionRun`(`applicationId`);
CREATE INDEX `LogCollectionRun_applicationServiceId_idx` ON `LogCollectionRun`(`applicationServiceId`);
CREATE INDEX `LogCollectionRun_serverId_idx` ON `LogCollectionRun`(`serverId`);
CREATE INDEX `LogCollectionRun_siteId_idx` ON `LogCollectionRun`(`siteId`);
CREATE INDEX `LogCollectionRun_managedResourceId_idx` ON `LogCollectionRun`(`managedResourceId`);
CREATE INDEX `LogCollectionRun_deploymentRunId_idx` ON `LogCollectionRun`(`deploymentRunId`);
CREATE INDEX `LogCollectionRun_backupPlanId_idx` ON `LogCollectionRun`(`backupPlanId`);
CREATE INDEX `LogCollectionRun_backupRunId_idx` ON `LogCollectionRun`(`backupRunId`);
CREATE INDEX `LogCollectionRun_alertEventId_idx` ON `LogCollectionRun`(`alertEventId`);
CREATE INDEX `LogCollectionRun_sourceType_idx` ON `LogCollectionRun`(`sourceType`);
CREATE INDEX `LogCollectionRun_sourceKey_idx` ON `LogCollectionRun`(`sourceKey`);
CREATE INDEX `LogCollectionRun_executorKey_idx` ON `LogCollectionRun`(`executorKey`);
CREATE INDEX `LogCollectionRun_adapterKey_idx` ON `LogCollectionRun`(`adapterKey`);
CREATE INDEX `LogCollectionRun_dryRun_idx` ON `LogCollectionRun`(`dryRun`);
CREATE INDEX `LogCollectionRun_status_idx` ON `LogCollectionRun`(`status`);
CREATE INDEX `LogCollectionRun_startedAt_idx` ON `LogCollectionRun`(`startedAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_logCollectionRunId_fkey` FOREIGN KEY (`logCollectionRunId`) REFERENCES `LogCollectionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_streamId_fkey` FOREIGN KEY (`streamId`) REFERENCES `LogStream`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_backupPlanId_fkey` FOREIGN KEY (`backupPlanId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_backupRunId_fkey` FOREIGN KEY (`backupRunId`) REFERENCES `BackupRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LogCollectionRun` ADD CONSTRAINT `LogCollectionRun_alertEventId_fkey` FOREIGN KEY (`alertEventId`) REFERENCES `AlertEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
