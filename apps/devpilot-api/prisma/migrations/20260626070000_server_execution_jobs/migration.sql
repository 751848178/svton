-- CreateTable
CREATE TABLE `ServerExecutionJob` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `retryOfId` VARCHAR(191) NULL,
    `operationKey` VARCHAR(191) NOT NULL,
    `adapterKey` VARCHAR(191) NOT NULL,
    `transport` VARCHAR(191) NOT NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `maxAttempts` INTEGER NOT NULL DEFAULT 1,
    `inputSnapshot` JSON NOT NULL,
    `commandPlan` JSON NULL,
    `logs` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `metadata` JSON NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ServerExecutionJob_teamId_idx` ON `ServerExecutionJob`(`teamId`);
CREATE INDEX `ServerExecutionJob_actorId_idx` ON `ServerExecutionJob`(`actorId`);
CREATE INDEX `ServerExecutionJob_serverId_idx` ON `ServerExecutionJob`(`serverId`);
CREATE INDEX `ServerExecutionJob_retryOfId_idx` ON `ServerExecutionJob`(`retryOfId`);
CREATE INDEX `ServerExecutionJob_operationKey_idx` ON `ServerExecutionJob`(`operationKey`);
CREATE INDEX `ServerExecutionJob_adapterKey_idx` ON `ServerExecutionJob`(`adapterKey`);
CREATE INDEX `ServerExecutionJob_transport_idx` ON `ServerExecutionJob`(`transport`);
CREATE INDEX `ServerExecutionJob_dryRun_idx` ON `ServerExecutionJob`(`dryRun`);
CREATE INDEX `ServerExecutionJob_status_idx` ON `ServerExecutionJob`(`status`);
CREATE INDEX `ServerExecutionJob_queuedAt_idx` ON `ServerExecutionJob`(`queuedAt`);
CREATE INDEX `ServerExecutionJob_startedAt_idx` ON `ServerExecutionJob`(`startedAt`);
CREATE INDEX `ServerExecutionJob_finishedAt_idx` ON `ServerExecutionJob`(`finishedAt`);

-- AddForeignKey
ALTER TABLE `ServerExecutionJob` ADD CONSTRAINT `ServerExecutionJob_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServerExecutionJob` ADD CONSTRAINT `ServerExecutionJob_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServerExecutionJob` ADD CONSTRAINT `ServerExecutionJob_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServerExecutionJob` ADD CONSTRAINT `ServerExecutionJob_retryOfId_fkey` FOREIGN KEY (`retryOfId`) REFERENCES `ServerExecutionJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
