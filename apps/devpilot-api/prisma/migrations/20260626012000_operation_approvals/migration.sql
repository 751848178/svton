-- AlterTable
ALTER TABLE `ApplicationServiceOperationRun` ADD COLUMN `operationApprovalId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ResourceActionRun` ADD COLUMN `operationApprovalId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `operationApprovalId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `OperationApproval` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `risk` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `summary` TEXT NULL,
    `reason` TEXT NULL,
    `reviewComment` TEXT NULL,
    `metadata` JSON NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ApplicationServiceOperationRun_operationApprovalId_idx` ON `ApplicationServiceOperationRun`(`operationApprovalId`);
CREATE INDEX `ResourceActionRun_operationApprovalId_idx` ON `ResourceActionRun`(`operationApprovalId`);
CREATE INDEX `AuditEvent_operationApprovalId_idx` ON `AuditEvent`(`operationApprovalId`);
CREATE INDEX `OperationApproval_teamId_idx` ON `OperationApproval`(`teamId`);
CREATE INDEX `OperationApproval_requesterId_idx` ON `OperationApproval`(`requesterId`);
CREATE INDEX `OperationApproval_reviewerId_idx` ON `OperationApproval`(`reviewerId`);
CREATE INDEX `OperationApproval_projectId_idx` ON `OperationApproval`(`projectId`);
CREATE INDEX `OperationApproval_environmentId_idx` ON `OperationApproval`(`environmentId`);
CREATE INDEX `OperationApproval_applicationId_idx` ON `OperationApproval`(`applicationId`);
CREATE INDEX `OperationApproval_applicationServiceId_idx` ON `OperationApproval`(`applicationServiceId`);
CREATE INDEX `OperationApproval_serverId_idx` ON `OperationApproval`(`serverId`);
CREATE INDEX `OperationApproval_siteId_idx` ON `OperationApproval`(`siteId`);
CREATE INDEX `OperationApproval_managedResourceId_idx` ON `OperationApproval`(`managedResourceId`);
CREATE INDEX `OperationApproval_category_idx` ON `OperationApproval`(`category`);
CREATE INDEX `OperationApproval_action_idx` ON `OperationApproval`(`action`);
CREATE INDEX `OperationApproval_targetType_idx` ON `OperationApproval`(`targetType`);
CREATE INDEX `OperationApproval_targetId_idx` ON `OperationApproval`(`targetId`);
CREATE INDEX `OperationApproval_risk_idx` ON `OperationApproval`(`risk`);
CREATE INDEX `OperationApproval_status_idx` ON `OperationApproval`(`status`);
CREATE INDEX `OperationApproval_requestedAt_idx` ON `OperationApproval`(`requestedAt`);
CREATE INDEX `OperationApproval_reviewedAt_idx` ON `OperationApproval`(`reviewedAt`);
CREATE INDEX `OperationApproval_consumedAt_idx` ON `OperationApproval`(`consumedAt`);

-- AddForeignKey
ALTER TABLE `ApplicationServiceOperationRun` ADD CONSTRAINT `ApplicationServiceOperationRun_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OperationApproval` ADD CONSTRAINT `OperationApproval_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
