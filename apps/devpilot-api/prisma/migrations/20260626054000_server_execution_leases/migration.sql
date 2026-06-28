-- CreateTable
CREATE TABLE `ServerExecutionLease` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `activeKey` VARCHAR(191) NULL,
    `operationKey` VARCHAR(191) NOT NULL,
    `adapterKey` VARCHAR(191) NOT NULL,
    `transport` VARCHAR(191) NOT NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `metadata` JSON NULL,
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `releasedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ServerExecutionLease_activeKey_key` ON `ServerExecutionLease`(`activeKey`);
CREATE INDEX `ServerExecutionLease_teamId_idx` ON `ServerExecutionLease`(`teamId`);
CREATE INDEX `ServerExecutionLease_actorId_idx` ON `ServerExecutionLease`(`actorId`);
CREATE INDEX `ServerExecutionLease_serverId_idx` ON `ServerExecutionLease`(`serverId`);
CREATE INDEX `ServerExecutionLease_operationKey_idx` ON `ServerExecutionLease`(`operationKey`);
CREATE INDEX `ServerExecutionLease_adapterKey_idx` ON `ServerExecutionLease`(`adapterKey`);
CREATE INDEX `ServerExecutionLease_transport_idx` ON `ServerExecutionLease`(`transport`);
CREATE INDEX `ServerExecutionLease_dryRun_idx` ON `ServerExecutionLease`(`dryRun`);
CREATE INDEX `ServerExecutionLease_status_idx` ON `ServerExecutionLease`(`status`);
CREATE INDEX `ServerExecutionLease_acquiredAt_idx` ON `ServerExecutionLease`(`acquiredAt`);
CREATE INDEX `ServerExecutionLease_releasedAt_idx` ON `ServerExecutionLease`(`releasedAt`);
CREATE INDEX `ServerExecutionLease_expiresAt_idx` ON `ServerExecutionLease`(`expiresAt`);

-- AddForeignKey
ALTER TABLE `ServerExecutionLease` ADD CONSTRAINT `ServerExecutionLease_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServerExecutionLease` ADD CONSTRAINT `ServerExecutionLease_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServerExecutionLease` ADD CONSTRAINT `ServerExecutionLease_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
