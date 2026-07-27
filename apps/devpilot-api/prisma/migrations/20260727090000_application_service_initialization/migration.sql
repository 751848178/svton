-- CreateTable
CREATE TABLE `ApplicationServiceInitialization` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `applicationServiceId` VARCHAR(191) NOT NULL,
    `commandFingerprint` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'reserved',
    `deploymentRunId` VARCHAR(191) NULL,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `error` TEXT NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_service_init_scope_command_key`(`applicationServiceId`, `environmentId`, `commandFingerprint`),
    INDEX `ApplicationServiceInitialization_teamId_status_idx`(`teamId`, `status`),
    INDEX `ApplicationServiceInitialization_projectId_idx`(`projectId`),
    INDEX `ApplicationServiceInitialization_deploymentRunId_idx`(`deploymentRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
