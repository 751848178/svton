-- CreateTable
CREATE TABLE `ProjectEnvironmentServer` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectEnvironmentServer_environmentId_serverId_key`(`environmentId`, `serverId`),
    INDEX `ProjectEnvironmentServer_teamId_idx`(`teamId`),
    INDEX `ProjectEnvironmentServer_projectId_idx`(`projectId`),
    INDEX `ProjectEnvironmentServer_environmentId_idx`(`environmentId`),
    INDEX `ProjectEnvironmentServer_serverId_idx`(`serverId`),
    INDEX `ProjectEnvironmentServer_role_idx`(`role`),
    INDEX `ProjectEnvironmentServer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `CDNConfig` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `SecretKey` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ResourceRequest` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ResourceInstance` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ManagedResource` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `CDNConfig_environmentId_idx` ON `CDNConfig`(`environmentId`);

-- CreateIndex
CREATE INDEX `SecretKey_environmentId_idx` ON `SecretKey`(`environmentId`);

-- CreateIndex
CREATE INDEX `ResourceRequest_environmentId_idx` ON `ResourceRequest`(`environmentId`);

-- CreateIndex
CREATE INDEX `ResourceInstance_environmentId_idx` ON `ResourceInstance`(`environmentId`);

-- CreateIndex
CREATE INDEX `ManagedResource_environmentId_idx` ON `ManagedResource`(`environmentId`);

-- AddForeignKey
ALTER TABLE `ProjectEnvironmentServer` ADD CONSTRAINT `ProjectEnvironmentServer_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectEnvironmentServer` ADD CONSTRAINT `ProjectEnvironmentServer_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectEnvironmentServer` ADD CONSTRAINT `ProjectEnvironmentServer_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectEnvironmentServer` ADD CONSTRAINT `ProjectEnvironmentServer_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CDNConfig` ADD CONSTRAINT `CDNConfig_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecretKey` ADD CONSTRAINT `SecretKey_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceInstance` ADD CONSTRAINT `ResourceInstance_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManagedResource` ADD CONSTRAINT `ManagedResource_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
