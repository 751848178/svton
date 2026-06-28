-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `resourceQueryRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ResourceQueryRun` (
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
    `queryType` VARCHAR(191) NOT NULL,
    `query` TEXT NULL,
    `authAdapterKey` VARCHAR(191) NOT NULL,
    `executorKey` VARCHAR(191) NOT NULL,
    `adapterKey` VARCHAR(191) NOT NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `params` JSON NULL,
    `queryPlan` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_resourceQueryRunId_idx` ON `AuditEvent`(`resourceQueryRunId`);
CREATE INDEX `ResourceQueryRun_teamId_idx` ON `ResourceQueryRun`(`teamId`);
CREATE INDEX `ResourceQueryRun_actorId_idx` ON `ResourceQueryRun`(`actorId`);
CREATE INDEX `ResourceQueryRun_resourceId_idx` ON `ResourceQueryRun`(`resourceId`);
CREATE INDEX `ResourceQueryRun_credentialId_idx` ON `ResourceQueryRun`(`credentialId`);
CREATE INDEX `ResourceQueryRun_projectId_idx` ON `ResourceQueryRun`(`projectId`);
CREATE INDEX `ResourceQueryRun_environmentId_idx` ON `ResourceQueryRun`(`environmentId`);
CREATE INDEX `ResourceQueryRun_serverId_idx` ON `ResourceQueryRun`(`serverId`);
CREATE INDEX `ResourceQueryRun_sourceType_idx` ON `ResourceQueryRun`(`sourceType`);
CREATE INDEX `ResourceQueryRun_provider_idx` ON `ResourceQueryRun`(`provider`);
CREATE INDEX `ResourceQueryRun_kind_idx` ON `ResourceQueryRun`(`kind`);
CREATE INDEX `ResourceQueryRun_queryType_idx` ON `ResourceQueryRun`(`queryType`);
CREATE INDEX `ResourceQueryRun_authAdapterKey_idx` ON `ResourceQueryRun`(`authAdapterKey`);
CREATE INDEX `ResourceQueryRun_executorKey_idx` ON `ResourceQueryRun`(`executorKey`);
CREATE INDEX `ResourceQueryRun_adapterKey_idx` ON `ResourceQueryRun`(`adapterKey`);
CREATE INDEX `ResourceQueryRun_dryRun_idx` ON `ResourceQueryRun`(`dryRun`);
CREATE INDEX `ResourceQueryRun_status_idx` ON `ResourceQueryRun`(`status`);
CREATE INDEX `ResourceQueryRun_startedAt_idx` ON `ResourceQueryRun`(`startedAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_resourceQueryRunId_fkey` FOREIGN KEY (`resourceQueryRunId`) REFERENCES `ResourceQueryRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceQueryRun` ADD CONSTRAINT `ResourceQueryRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
