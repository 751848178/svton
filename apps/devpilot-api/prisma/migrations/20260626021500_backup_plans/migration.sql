-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `backupRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BackupPlan` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `backupType` VARCHAR(191) NOT NULL DEFAULT 'logical',
    `schedule` VARCHAR(191) NULL,
    `retentionDays` INTEGER NOT NULL DEFAULT 7,
    `destinationType` VARCHAR(191) NOT NULL DEFAULT 'local',
    `destination` JSON NULL,
    `config` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastRunAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NULL,
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `backupType` VARCHAR(191) NOT NULL DEFAULT 'logical',
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'server-executor',
    `adapterKey` VARCHAR(191) NOT NULL DEFAULT 'backup-script-plan',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `destinationType` VARCHAR(191) NOT NULL DEFAULT 'local',
    `destination` JSON NULL,
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
CREATE INDEX `AuditEvent_backupRunId_idx` ON `AuditEvent`(`backupRunId`);
CREATE INDEX `BackupPlan_teamId_idx` ON `BackupPlan`(`teamId`);
CREATE INDEX `BackupPlan_createdById_idx` ON `BackupPlan`(`createdById`);
CREATE INDEX `BackupPlan_projectId_idx` ON `BackupPlan`(`projectId`);
CREATE INDEX `BackupPlan_environmentId_idx` ON `BackupPlan`(`environmentId`);
CREATE INDEX `BackupPlan_resourceId_idx` ON `BackupPlan`(`resourceId`);
CREATE INDEX `BackupPlan_serverId_idx` ON `BackupPlan`(`serverId`);
CREATE INDEX `BackupPlan_backupType_idx` ON `BackupPlan`(`backupType`);
CREATE INDEX `BackupPlan_destinationType_idx` ON `BackupPlan`(`destinationType`);
CREATE INDEX `BackupPlan_status_idx` ON `BackupPlan`(`status`);
CREATE INDEX `BackupPlan_lastRunAt_idx` ON `BackupPlan`(`lastRunAt`);
CREATE INDEX `BackupRun_teamId_idx` ON `BackupRun`(`teamId`);
CREATE INDEX `BackupRun_planId_idx` ON `BackupRun`(`planId`);
CREATE INDEX `BackupRun_actorId_idx` ON `BackupRun`(`actorId`);
CREATE INDEX `BackupRun_projectId_idx` ON `BackupRun`(`projectId`);
CREATE INDEX `BackupRun_environmentId_idx` ON `BackupRun`(`environmentId`);
CREATE INDEX `BackupRun_resourceId_idx` ON `BackupRun`(`resourceId`);
CREATE INDEX `BackupRun_serverId_idx` ON `BackupRun`(`serverId`);
CREATE INDEX `BackupRun_trigger_idx` ON `BackupRun`(`trigger`);
CREATE INDEX `BackupRun_backupType_idx` ON `BackupRun`(`backupType`);
CREATE INDEX `BackupRun_executorKey_idx` ON `BackupRun`(`executorKey`);
CREATE INDEX `BackupRun_adapterKey_idx` ON `BackupRun`(`adapterKey`);
CREATE INDEX `BackupRun_dryRun_idx` ON `BackupRun`(`dryRun`);
CREATE INDEX `BackupRun_status_idx` ON `BackupRun`(`status`);
CREATE INDEX `BackupRun_startedAt_idx` ON `BackupRun`(`startedAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_backupRunId_fkey` FOREIGN KEY (`backupRunId`) REFERENCES `BackupRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BackupPlan` ADD CONSTRAINT `BackupPlan_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
