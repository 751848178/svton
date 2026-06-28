-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `deploymentRunId` VARCHAR(191) NULL,
    `resourceActionRunId` VARCHAR(191) NULL,
    `applicationServiceOperationRunId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `risk` VARCHAR(191) NOT NULL DEFAULT 'low',
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `summary` TEXT NULL,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_teamId_idx` ON `AuditEvent`(`teamId`);
CREATE INDEX `AuditEvent_actorId_idx` ON `AuditEvent`(`actorId`);
CREATE INDEX `AuditEvent_projectId_idx` ON `AuditEvent`(`projectId`);
CREATE INDEX `AuditEvent_environmentId_idx` ON `AuditEvent`(`environmentId`);
CREATE INDEX `AuditEvent_applicationId_idx` ON `AuditEvent`(`applicationId`);
CREATE INDEX `AuditEvent_applicationServiceId_idx` ON `AuditEvent`(`applicationServiceId`);
CREATE INDEX `AuditEvent_serverId_idx` ON `AuditEvent`(`serverId`);
CREATE INDEX `AuditEvent_siteId_idx` ON `AuditEvent`(`siteId`);
CREATE INDEX `AuditEvent_managedResourceId_idx` ON `AuditEvent`(`managedResourceId`);
CREATE INDEX `AuditEvent_deploymentRunId_idx` ON `AuditEvent`(`deploymentRunId`);
CREATE INDEX `AuditEvent_resourceActionRunId_idx` ON `AuditEvent`(`resourceActionRunId`);
CREATE INDEX `AuditEvent_applicationServiceOperationRunId_idx` ON `AuditEvent`(`applicationServiceOperationRunId`);
CREATE INDEX `AuditEvent_category_idx` ON `AuditEvent`(`category`);
CREATE INDEX `AuditEvent_action_idx` ON `AuditEvent`(`action`);
CREATE INDEX `AuditEvent_targetType_idx` ON `AuditEvent`(`targetType`);
CREATE INDEX `AuditEvent_targetId_idx` ON `AuditEvent`(`targetId`);
CREATE INDEX `AuditEvent_risk_idx` ON `AuditEvent`(`risk`);
CREATE INDEX `AuditEvent_status_idx` ON `AuditEvent`(`status`);
CREATE INDEX `AuditEvent_occurredAt_idx` ON `AuditEvent`(`occurredAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_resourceActionRunId_fkey` FOREIGN KEY (`resourceActionRunId`) REFERENCES `ResourceActionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_applicationServiceOperationRunId_fkey` FOREIGN KEY (`applicationServiceOperationRunId`) REFERENCES `ApplicationServiceOperationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
