-- AlterTable
ALTER TABLE `AuditEvent` ADD COLUMN `alertEventId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AlertRule` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `backupPlanId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'service',
    `metric` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'warning',
    `condition` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `evaluationMode` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `intervalSeconds` INTEGER NOT NULL DEFAULT 300,
    `lastEvaluatedAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(191) NULL,
    `lastMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertEvent` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `managedResourceId` VARCHAR(191) NULL,
    `backupPlanId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `metric` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'warning',
    `status` VARCHAR(191) NOT NULL DEFAULT 'firing',
    `value` JSON NULL,
    `condition` JSON NULL,
    `summary` TEXT NULL,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditEvent_alertEventId_idx` ON `AuditEvent`(`alertEventId`);
CREATE INDEX `AlertRule_teamId_idx` ON `AlertRule`(`teamId`);
CREATE INDEX `AlertRule_createdById_idx` ON `AlertRule`(`createdById`);
CREATE INDEX `AlertRule_projectId_idx` ON `AlertRule`(`projectId`);
CREATE INDEX `AlertRule_environmentId_idx` ON `AlertRule`(`environmentId`);
CREATE INDEX `AlertRule_applicationId_idx` ON `AlertRule`(`applicationId`);
CREATE INDEX `AlertRule_applicationServiceId_idx` ON `AlertRule`(`applicationServiceId`);
CREATE INDEX `AlertRule_serverId_idx` ON `AlertRule`(`serverId`);
CREATE INDEX `AlertRule_siteId_idx` ON `AlertRule`(`siteId`);
CREATE INDEX `AlertRule_managedResourceId_idx` ON `AlertRule`(`managedResourceId`);
CREATE INDEX `AlertRule_backupPlanId_idx` ON `AlertRule`(`backupPlanId`);
CREATE INDEX `AlertRule_category_idx` ON `AlertRule`(`category`);
CREATE INDEX `AlertRule_metric_idx` ON `AlertRule`(`metric`);
CREATE INDEX `AlertRule_severity_idx` ON `AlertRule`(`severity`);
CREATE INDEX `AlertRule_enabled_idx` ON `AlertRule`(`enabled`);
CREATE INDEX `AlertRule_lastEvaluatedAt_idx` ON `AlertRule`(`lastEvaluatedAt`);
CREATE INDEX `AlertRule_lastStatus_idx` ON `AlertRule`(`lastStatus`);
CREATE INDEX `AlertEvent_teamId_idx` ON `AlertEvent`(`teamId`);
CREATE INDEX `AlertEvent_ruleId_idx` ON `AlertEvent`(`ruleId`);
CREATE INDEX `AlertEvent_actorId_idx` ON `AlertEvent`(`actorId`);
CREATE INDEX `AlertEvent_projectId_idx` ON `AlertEvent`(`projectId`);
CREATE INDEX `AlertEvent_environmentId_idx` ON `AlertEvent`(`environmentId`);
CREATE INDEX `AlertEvent_applicationId_idx` ON `AlertEvent`(`applicationId`);
CREATE INDEX `AlertEvent_applicationServiceId_idx` ON `AlertEvent`(`applicationServiceId`);
CREATE INDEX `AlertEvent_serverId_idx` ON `AlertEvent`(`serverId`);
CREATE INDEX `AlertEvent_siteId_idx` ON `AlertEvent`(`siteId`);
CREATE INDEX `AlertEvent_managedResourceId_idx` ON `AlertEvent`(`managedResourceId`);
CREATE INDEX `AlertEvent_backupPlanId_idx` ON `AlertEvent`(`backupPlanId`);
CREATE INDEX `AlertEvent_category_idx` ON `AlertEvent`(`category`);
CREATE INDEX `AlertEvent_metric_idx` ON `AlertEvent`(`metric`);
CREATE INDEX `AlertEvent_severity_idx` ON `AlertEvent`(`severity`);
CREATE INDEX `AlertEvent_status_idx` ON `AlertEvent`(`status`);
CREATE INDEX `AlertEvent_occurredAt_idx` ON `AlertEvent`(`occurredAt`);

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_alertEventId_fkey` FOREIGN KEY (`alertEventId`) REFERENCES `AlertEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertRule` ADD CONSTRAINT `AlertRule_backupPlanId_fkey` FOREIGN KEY (`backupPlanId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `AlertRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_managedResourceId_fkey` FOREIGN KEY (`managedResourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertEvent` ADD CONSTRAINT `AlertEvent_backupPlanId_fkey` FOREIGN KEY (`backupPlanId`) REFERENCES `BackupPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
