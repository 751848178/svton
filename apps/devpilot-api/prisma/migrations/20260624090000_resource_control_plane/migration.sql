-- CreateTable
CREATE TABLE `ManagedResource` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `resourceInstanceId` VARCHAR(191) NULL,
    `credentialId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `endpoint` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `config` JSON NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `syncError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManagedResource_teamId_sourceType_provider_externalId_key`(`teamId`, `sourceType`, `provider`, `externalId`),
    INDEX `ManagedResource_teamId_idx`(`teamId`),
    INDEX `ManagedResource_createdById_idx`(`createdById`),
    INDEX `ManagedResource_serverId_idx`(`serverId`),
    INDEX `ManagedResource_projectId_idx`(`projectId`),
    INDEX `ManagedResource_resourceInstanceId_idx`(`resourceInstanceId`),
    INDEX `ManagedResource_credentialId_idx`(`credentialId`),
    INDEX `ManagedResource_sourceType_idx`(`sourceType`),
    INDEX `ManagedResource_provider_idx`(`provider`),
    INDEX `ManagedResource_kind_idx`(`kind`),
    INDEX `ManagedResource_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceSyncRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `credentialId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `discovered` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResourceSyncRun_teamId_idx`(`teamId`),
    INDEX `ResourceSyncRun_actorId_idx`(`actorId`),
    INDEX `ResourceSyncRun_serverId_idx`(`serverId`),
    INDEX `ResourceSyncRun_credentialId_idx`(`credentialId`),
    INDEX `ResourceSyncRun_sourceType_idx`(`sourceType`),
    INDEX `ResourceSyncRun_provider_idx`(`provider`),
    INDEX `ResourceSyncRun_status_idx`(`status`),
    INDEX `ResourceSyncRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_resourceInstanceId_fkey` FOREIGN KEY (`resourceInstanceId`) REFERENCES `ResourceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceSyncRun` ADD CONSTRAINT `ResourceSyncRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceSyncRun` ADD CONSTRAINT `ResourceSyncRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceSyncRun` ADD CONSTRAINT `ResourceSyncRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceSyncRun` ADD CONSTRAINT `ResourceSyncRun_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
