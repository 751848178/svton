-- CreateTable
CREATE TABLE `LogRetentionRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `streamId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `retentionDays` INTEGER NOT NULL,
    `cutoffAt` DATETIME(3) NOT NULL,
    `matchedEntryCount` INTEGER NOT NULL DEFAULT 0,
    `deletedEntryCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `logRetentionRunId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `LogRetentionRun_teamId_idx` ON `LogRetentionRun`(`teamId`);
CREATE INDEX `LogRetentionRun_streamId_idx` ON `LogRetentionRun`(`streamId`);
CREATE INDEX `LogRetentionRun_actorId_idx` ON `LogRetentionRun`(`actorId`);
CREATE INDEX `LogRetentionRun_projectId_idx` ON `LogRetentionRun`(`projectId`);
CREATE INDEX `LogRetentionRun_environmentId_idx` ON `LogRetentionRun`(`environmentId`);
CREATE INDEX `LogRetentionRun_dryRun_idx` ON `LogRetentionRun`(`dryRun`);
CREATE INDEX `LogRetentionRun_status_idx` ON `LogRetentionRun`(`status`);
CREATE INDEX `LogRetentionRun_cutoffAt_idx` ON `LogRetentionRun`(`cutoffAt`);
CREATE INDEX `LogRetentionRun_startedAt_idx` ON `LogRetentionRun`(`startedAt`);
CREATE INDEX `AuditEvent_logRetentionRunId_idx` ON `AuditEvent`(`logRetentionRunId`);

-- AddForeignKey
ALTER TABLE `LogRetentionRun`
    ADD CONSTRAINT `LogRetentionRun_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LogRetentionRun`
    ADD CONSTRAINT `LogRetentionRun_streamId_fkey`
    FOREIGN KEY (`streamId`) REFERENCES `LogStream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LogRetentionRun`
    ADD CONSTRAINT `LogRetentionRun_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AuditEvent`
    ADD CONSTRAINT `AuditEvent_logRetentionRunId_fkey`
    FOREIGN KEY (`logRetentionRunId`) REFERENCES `LogRetentionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
