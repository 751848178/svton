-- CreateTable
CREATE TABLE `Application` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `repositoryUrl` VARCHAR(191) NULL,
    `repoPath` VARCHAR(191) NULL,
    `defaultBranch` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Application_projectId_name_key`(`projectId`, `name`),
    INDEX `Application_teamId_idx`(`teamId`),
    INDEX `Application_projectId_idx`(`projectId`),
    INDEX `Application_createdById_idx`(`createdById`),
    INDEX `Application_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationService` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'docker-compose',
    `runtime` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `ports` JSON NULL,
    `env` JSON NULL,
    `secretKeyIds` JSON NULL,
    `deployConfig` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApplicationService_applicationId_environmentId_name_key`(`applicationId`, `environmentId`, `name`),
    INDEX `ApplicationService_teamId_idx`(`teamId`),
    INDEX `ApplicationService_projectId_idx`(`projectId`),
    INDEX `ApplicationService_applicationId_idx`(`applicationId`),
    INDEX `ApplicationService_environmentId_idx`(`environmentId`),
    INDEX `ApplicationService_serverId_idx`(`serverId`),
    INDEX `ApplicationService_siteId_idx`(`siteId`),
    INDEX `ApplicationService_managedResourceId_idx`(`managedResourceId`),
    INDEX `ApplicationService_kind_idx`(`kind`),
    INDEX `ApplicationService_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `DeploymentRun` ADD COLUMN `applicationId` VARCHAR(191) NULL,
    ADD COLUMN `applicationServiceId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `DeploymentRun_applicationId_idx` ON `DeploymentRun`(`applicationId`);

-- CreateIndex
CREATE INDEX `DeploymentRun_applicationServiceId_idx` ON `DeploymentRun`(`applicationServiceId`);

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationService` ADD CONSTRAINT `ApplicationService_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
