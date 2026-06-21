-- CreateTable
CREATE TABLE `ResourceType` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `requestSchema` JSON NULL,
    `deliverySchema` JSON NULL,
    `envTemplate` TEXT NULL,
    `approvalMode` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `provisioningMode` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `provisioningConfig` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ResourceType_key_key`(`key`),
    INDEX `ResourceType_category_idx`(`category`),
    INDEX `ResourceType_enabled_idx`(`enabled`),
    INDEX `ResourceType_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceRequest` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `resourceTypeId` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NULL,
    `purpose` TEXT NULL,
    `spec` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `approvalComment` TEXT NULL,
    `result` JSON NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResourceRequest_teamId_idx`(`teamId`),
    INDEX `ResourceRequest_projectId_idx`(`projectId`),
    INDEX `ResourceRequest_resourceTypeId_idx`(`resourceTypeId`),
    INDEX `ResourceRequest_requesterId_idx`(`requesterId`),
    INDEX `ResourceRequest_reviewerId_idx`(`reviewerId`),
    INDEX `ResourceRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceInstance` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `resourceTypeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `config` JSON NULL,
    `credentials` TEXT NULL,
    `delivery` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ResourceInstance_requestId_key`(`requestId`),
    INDEX `ResourceInstance_teamId_idx`(`teamId`),
    INDEX `ResourceInstance_projectId_idx`(`projectId`),
    INDEX `ResourceInstance_resourceTypeId_idx`(`resourceTypeId`),
    INDEX `ResourceInstance_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `resourceTypeId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `instanceId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResourceAuditLog_teamId_idx`(`teamId`),
    INDEX `ResourceAuditLog_resourceTypeId_idx`(`resourceTypeId`),
    INDEX `ResourceAuditLog_requestId_idx`(`requestId`),
    INDEX `ResourceAuditLog_instanceId_idx`(`instanceId`),
    INDEX `ResourceAuditLog_actorId_idx`(`actorId`),
    INDEX `ResourceAuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ResourceType` ADD CONSTRAINT `ResourceType_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `ResourceType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceRequest` ADD CONSTRAINT `ResourceRequest_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceInstance` ADD CONSTRAINT `ResourceInstance_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceInstance` ADD CONSTRAINT `ResourceInstance_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceInstance` ADD CONSTRAINT `ResourceInstance_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ResourceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceInstance` ADD CONSTRAINT `ResourceInstance_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `ResourceType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_resourceTypeId_fkey` FOREIGN KEY (`resourceTypeId`) REFERENCES `ResourceType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ResourceRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_instanceId_fkey` FOREIGN KEY (`instanceId`) REFERENCES `ResourceInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceAuditLog` ADD CONSTRAINT `ResourceAuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
