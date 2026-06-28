-- CreateTable
CREATE TABLE `Site` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `proxyConfigId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `primaryDomain` VARCHAR(191) NOT NULL,
    `aliases` JSON NULL,
    `runtimeType` VARCHAR(191) NOT NULL DEFAULT 'reverse_proxy',
    `runtimeConfig` JSON NULL,
    `tls` JSON NULL,
    `accessPolicy` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `lastSyncAt` DATETIME(3) NULL,
    `syncError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Site_teamId_idx`(`teamId`),
    INDEX `Site_createdById_idx`(`createdById`),
    INDEX `Site_projectId_idx`(`projectId`),
    INDEX `Site_serverId_idx`(`serverId`),
    INDEX `Site_proxyConfigId_idx`(`proxyConfigId`),
    INDEX `Site_primaryDomain_idx`(`primaryDomain`),
    INDEX `Site_runtimeType_idx`(`runtimeType`),
    INDEX `Site_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_proxyConfigId_fkey` FOREIGN KEY (`proxyConfigId`) REFERENCES `ProxyConfig`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
