-- CreateTable
CREATE TABLE `DeploymentRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `environment` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `targetType` VARCHAR(191) NOT NULL,
    `executorKey` VARCHAR(191) NOT NULL DEFAULT 'server-executor',
    `adapterKey` VARCHAR(191) NOT NULL DEFAULT 'script-plan',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `gitRepo` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `commitSha` VARCHAR(191) NULL,
    `workingDirectory` VARCHAR(191) NULL,
    `buildCommand` TEXT NULL,
    `deployCommand` TEXT NULL,
    `healthCheckUrl` VARCHAR(191) NULL,
    `params` JSON NULL,
    `commandPlan` JSON NULL,
    `logs` JSON NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeploymentRun_teamId_idx`(`teamId`),
    INDEX `DeploymentRun_projectId_idx`(`projectId`),
    INDEX `DeploymentRun_actorId_idx`(`actorId`),
    INDEX `DeploymentRun_serverId_idx`(`serverId`),
    INDEX `DeploymentRun_environment_idx`(`environment`),
    INDEX `DeploymentRun_source_idx`(`source`),
    INDEX `DeploymentRun_targetType_idx`(`targetType`),
    INDEX `DeploymentRun_status_idx`(`status`),
    INDEX `DeploymentRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
