-- CreateTable
CREATE TABLE `ProxyConfig` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `upstreams` JSON NOT NULL,
    `ssl` JSON NOT NULL,
    `websocket` BOOLEAN NOT NULL DEFAULT false,
    `customConfig` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `lastSyncAt` DATETIME(3) NULL,
    `syncError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProxyConfig_teamId_idx`(`teamId`),
    INDEX `ProxyConfig_domain_idx`(`domain`),
    INDEX `ProxyConfig_projectId_idx`(`projectId`),
    INDEX `ProxyConfig_createdById_idx`(`createdById`),
    INDEX `ProxyConfig_serverId_idx`(`serverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CDNConfig` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `credentialId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `origin` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `cacheRules` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `providerData` JSON NULL,
    `syncError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CDNConfig_teamId_idx`(`teamId`),
    INDEX `CDNConfig_domain_idx`(`domain`),
    INDEX `CDNConfig_projectId_idx`(`projectId`),
    INDEX `CDNConfig_createdById_idx`(`createdById`),
    INDEX `CDNConfig_credentialId_idx`(`credentialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProxyConfig` ADD CONSTRAINT `ProxyConfig_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProxyConfig` ADD CONSTRAINT `ProxyConfig_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProxyConfig` ADD CONSTRAINT `ProxyConfig_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProxyConfig` ADD CONSTRAINT `ProxyConfig_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CDNConfig` ADD CONSTRAINT `CDNConfig_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CDNConfig` ADD CONSTRAINT `CDNConfig_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CDNConfig` ADD CONSTRAINT `CDNConfig_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CDNConfig` ADD CONSTRAINT `CDNConfig_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
