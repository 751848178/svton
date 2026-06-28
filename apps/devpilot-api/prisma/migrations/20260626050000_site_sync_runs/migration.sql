-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `siteSyncRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `SiteSyncRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `sourceRunId` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'sync',
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'server-executor',
    `adapterKey` VARCHAR(191) NOT NULL DEFAULT 'nginx-site-plan',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `targetConfigPath` VARCHAR(191) NULL,
    `nginxConfig` TEXT NOT NULL,
    `commandPlan` JSON NULL,
    `executionPlan` JSON NULL,
    `logs` JSON NULL,
    `result` JSON NULL,
    `warnings` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_siteSyncRunId_idx` ON `AuditEvent`(`siteSyncRunId`);
CREATE INDEX `SiteSyncRun_teamId_idx` ON `SiteSyncRun`(`teamId`);
CREATE INDEX `SiteSyncRun_actorId_idx` ON `SiteSyncRun`(`actorId`);
CREATE INDEX `SiteSyncRun_siteId_idx` ON `SiteSyncRun`(`siteId`);
CREATE INDEX `SiteSyncRun_projectId_idx` ON `SiteSyncRun`(`projectId`);
CREATE INDEX `SiteSyncRun_environmentId_idx` ON `SiteSyncRun`(`environmentId`);
CREATE INDEX `SiteSyncRun_serverId_idx` ON `SiteSyncRun`(`serverId`);
CREATE INDEX `SiteSyncRun_sourceRunId_idx` ON `SiteSyncRun`(`sourceRunId`);
CREATE INDEX `SiteSyncRun_mode_idx` ON `SiteSyncRun`(`mode`);
CREATE INDEX `SiteSyncRun_trigger_idx` ON `SiteSyncRun`(`trigger`);
CREATE INDEX `SiteSyncRun_executorKey_idx` ON `SiteSyncRun`(`executorKey`);
CREATE INDEX `SiteSyncRun_adapterKey_idx` ON `SiteSyncRun`(`adapterKey`);
CREATE INDEX `SiteSyncRun_dryRun_idx` ON `SiteSyncRun`(`dryRun`);
CREATE INDEX `SiteSyncRun_status_idx` ON `SiteSyncRun`(`status`);
CREATE INDEX `SiteSyncRun_startedAt_idx` ON `SiteSyncRun`(`startedAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_siteSyncRunId_fkey` FOREIGN KEY (`siteSyncRunId`) REFERENCES `SiteSyncRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_sourceRunId_fkey` FOREIGN KEY (`sourceRunId`) REFERENCES `SiteSyncRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
