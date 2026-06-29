-- AlterTable
ALTER TABLE `ResourceAuditLog` ADD COLUMN `provisioningRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ResourceProvisioningRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `replayOfRunId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `resourceTypeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `credentialId` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL,
    `trigger` VARCHAR(191) NOT NULL,
    `boundary` VARCHAR(191) NOT NULL DEFAULT 'http_adapter',
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'resource-request',
    `adapterKey` VARCHAR(191) NOT NULL,
    `authAdapterKey` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `providerRunId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `queueMode` VARCHAR(191) NOT NULL DEFAULT 'inline',
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 1,
    `retryable` BOOLEAN NOT NULL DEFAULT false,
    `autoRetry` BOOLEAN NOT NULL DEFAULT false,
    `params` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `queuedAt` DATETIME(3) NULL,
    `availableAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockOwner` VARCHAR(191) NULL,
    `finishedAt` DATETIME(3) NULL,
    `recoveredAt` DATETIME(3) NULL,
    `recoveryReason` TEXT NULL,
    `recoveryCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ResourceAuditLog_provisioningRunId_idx` ON `ResourceAuditLog`(`provisioningRunId`);
CREATE INDEX `ResourceProvisioningRun_teamId_idx` ON `ResourceProvisioningRun`(`teamId`);
CREATE INDEX `ResourceProvisioningRun_actorId_idx` ON `ResourceProvisioningRun`(`actorId`);
CREATE INDEX `ResourceProvisioningRun_replayOfRunId_idx` ON `ResourceProvisioningRun`(`replayOfRunId`);
CREATE INDEX `ResourceProvisioningRun_requestId_idx` ON `ResourceProvisioningRun`(`requestId`);
CREATE INDEX `ResourceProvisioningRun_resourceTypeId_idx` ON `ResourceProvisioningRun`(`resourceTypeId`);
CREATE INDEX `ResourceProvisioningRun_projectId_idx` ON `ResourceProvisioningRun`(`projectId`);
CREATE INDEX `ResourceProvisioningRun_environmentId_idx` ON `ResourceProvisioningRun`(`environmentId`);
CREATE INDEX `ResourceProvisioningRun_credentialId_idx` ON `ResourceProvisioningRun`(`credentialId`);
CREATE INDEX `ResourceProvisioningRun_mode_idx` ON `ResourceProvisioningRun`(`mode`);
CREATE INDEX `ResourceProvisioningRun_trigger_idx` ON `ResourceProvisioningRun`(`trigger`);
CREATE INDEX `ResourceProvisioningRun_boundary_idx` ON `ResourceProvisioningRun`(`boundary`);
CREATE INDEX `ResourceProvisioningRun_executorKey_idx` ON `ResourceProvisioningRun`(`executorKey`);
CREATE INDEX `ResourceProvisioningRun_adapterKey_idx` ON `ResourceProvisioningRun`(`adapterKey`);
CREATE INDEX `ResourceProvisioningRun_authAdapterKey_idx` ON `ResourceProvisioningRun`(`authAdapterKey`);
CREATE INDEX `ResourceProvisioningRun_idempotencyKey_idx` ON `ResourceProvisioningRun`(`idempotencyKey`);
CREATE INDEX `ResourceProvisioningRun_providerRunId_idx` ON `ResourceProvisioningRun`(`providerRunId`);
CREATE INDEX `ResourceProvisioningRun_status_idx` ON `ResourceProvisioningRun`(`status`);
CREATE INDEX `ResourceProvisioningRun_queueMode_idx` ON `ResourceProvisioningRun`(`queueMode`);
CREATE INDEX `ResourceProvisioningRun_startedAt_idx` ON `ResourceProvisioningRun`(`startedAt`);
CREATE INDEX `ResourceProvisioningRun_availableAt_idx` ON `ResourceProvisioningRun`(`availableAt`);
CREATE INDEX `ResourceProvisioningRun_lockedAt_idx` ON `ResourceProvisioningRun`(`lockedAt`);
CREATE INDEX `ResourceProvisioningRun_recoveredAt_idx` ON `ResourceProvisioningRun`(`recoveredAt`);
CREATE INDEX `ResourceProvisioningRun_teamId_status_queueMode_availableAt_idx` ON `ResourceProvisioningRun`(`teamId`, `status`, `queueMode`, `availableAt`);

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_provisioningRunId_fkey` FOREIGN KEY (`provisioningRunId`) REFERENCES `ResourceProvisioningRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_replayOfRunId_fkey` FOREIGN KEY (`replayOfRunId`) REFERENCES `ResourceProvisioningRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ResourceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `ResourceType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceProvisioningRun` ADD CONSTRAINT `ResourceProvisioningRun_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
