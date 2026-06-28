-- CreateTable
CREATE TABLE `ApplicationServiceOperationRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `applicationServiceId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'server-executor',
    `adapterKey` VARCHAR(191) NOT NULL DEFAULT 'script-plan',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `risk` VARCHAR(191) NOT NULL DEFAULT 'low',
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `params` JSON NULL,
    `commandPlan` JSON NULL,
    `logs` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationServiceOperationRun_teamId_idx`(`teamId`),
    INDEX `ApplicationServiceOperationRun_projectId_idx`(`projectId`),
    INDEX `ApplicationServiceOperationRun_applicationId_idx`(`applicationId`),
    INDEX `ApplicationServiceOperationRun_applicationServiceId_idx`(`applicationServiceId`),
    INDEX `ApplicationServiceOperationRun_environmentId_idx`(`environmentId`),
    INDEX `ApplicationServiceOperationRun_serverId_idx`(`serverId`),
    INDEX `ApplicationServiceOperationRun_actorId_idx`(`actorId`),
    INDEX `ApplicationServiceOperationRun_action_idx`(`action`),
    INDEX `ApplicationServiceOperationRun_executorKey_idx`(`executorKey`),
    INDEX `ApplicationServiceOperationRun_adapterKey_idx`(`adapterKey`),
    INDEX `ApplicationServiceOperationRun_status_idx`(`status`),
    INDEX `ApplicationServiceOperationRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
