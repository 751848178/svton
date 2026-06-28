-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `resourceConnectionRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ResourceConnectionRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `targetEndpoint` VARCHAR(191) NULL,
    `authAdapterKey` VARCHAR(191) NOT NULL,
    `executorKey` VARCHAR(191) NOT NULL,
    `adapterKey` VARCHAR(191) NOT NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `params` JSON NULL,
    `connectionPlan` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_resourceConnectionRunId_idx` ON `AuditEvent`(`resourceConnectionRunId`);
CREATE INDEX `ResourceConnectionRun_teamId_idx` ON `ResourceConnectionRun`(`teamId`);
CREATE INDEX `ResourceConnectionRun_actorId_idx` ON `ResourceConnectionRun`(`actorId`);
CREATE INDEX `ResourceConnectionRun_resourceId_idx` ON `ResourceConnectionRun`(`resourceId`);
CREATE INDEX `ResourceConnectionRun_credentialId_idx` ON `ResourceConnectionRun`(`credentialId`);
CREATE INDEX `ResourceConnectionRun_projectId_idx` ON `ResourceConnectionRun`(`projectId`);
CREATE INDEX `ResourceConnectionRun_environmentId_idx` ON `ResourceConnectionRun`(`environmentId`);
CREATE INDEX `ResourceConnectionRun_serverId_idx` ON `ResourceConnectionRun`(`serverId`);
CREATE INDEX `ResourceConnectionRun_sourceType_idx` ON `ResourceConnectionRun`(`sourceType`);
CREATE INDEX `ResourceConnectionRun_provider_idx` ON `ResourceConnectionRun`(`provider`);
CREATE INDEX `ResourceConnectionRun_kind_idx` ON `ResourceConnectionRun`(`kind`);
CREATE INDEX `ResourceConnectionRun_authAdapterKey_idx` ON `ResourceConnectionRun`(`authAdapterKey`);
CREATE INDEX `ResourceConnectionRun_executorKey_idx` ON `ResourceConnectionRun`(`executorKey`);
CREATE INDEX `ResourceConnectionRun_adapterKey_idx` ON `ResourceConnectionRun`(`adapterKey`);
CREATE INDEX `ResourceConnectionRun_dryRun_idx` ON `ResourceConnectionRun`(`dryRun`);
CREATE INDEX `ResourceConnectionRun_status_idx` ON `ResourceConnectionRun`(`status`);
CREATE INDEX `ResourceConnectionRun_startedAt_idx` ON `ResourceConnectionRun`(`startedAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_resourceConnectionRunId_fkey` FOREIGN KEY (`resourceConnectionRunId`) REFERENCES `ResourceConnectionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceConnectionRun` ADD CONSTRAINT `ResourceConnectionRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
