-- CreateTable
CREATE TABLE `ResourceActionRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `executorKey` VARCHAR(191) NOT NULL,
    `adapterKey` VARCHAR(191) NOT NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `risk` VARCHAR(191) NOT NULL DEFAULT 'low',
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `params` JSON NULL,
    `commandPlan` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResourceActionRun_teamId_idx`(`teamId`),
    INDEX `ResourceActionRun_actorId_idx`(`actorId`),
    INDEX `ResourceActionRun_resourceId_idx`(`resourceId`),
    INDEX `ResourceActionRun_credentialId_idx`(`credentialId`),
    INDEX `ResourceActionRun_action_idx`(`action`),
    INDEX `ResourceActionRun_executorKey_idx`(`executorKey`),
    INDEX `ResourceActionRun_adapterKey_idx`(`adapterKey`),
    INDEX `ResourceActionRun_status_idx`(`status`),
    INDEX `ResourceActionRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
