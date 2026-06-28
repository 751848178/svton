-- CreateTable
CREATE TABLE `AlertNotificationChannel` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'webhook',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `config` JSON NULL,
    `secretConfig` JSON NULL,
    `eventStatuses` JSON NULL,
    `severityFilter` JSON NULL,
    `lastStatus` VARCHAR(191) NULL,
    `lastDeliveredAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertNotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `alertEventId` VARCHAR(191) NOT NULL,
    `channelType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'planned',
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `target` VARCHAR(191) NULL,
    `requestPayload` JSON NULL,
    `responseStatus` INTEGER NULL,
    `responseBody` TEXT NULL,
    `error` TEXT NULL,
    `attemptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AlertNotificationChannel_teamId_idx` ON `AlertNotificationChannel`(`teamId`);
CREATE INDEX `AlertNotificationChannel_createdById_idx` ON `AlertNotificationChannel`(`createdById`);
CREATE INDEX `AlertNotificationChannel_projectId_idx` ON `AlertNotificationChannel`(`projectId`);
CREATE INDEX `AlertNotificationChannel_environmentId_idx` ON `AlertNotificationChannel`(`environmentId`);
CREATE INDEX `AlertNotificationChannel_type_idx` ON `AlertNotificationChannel`(`type`);
CREATE INDEX `AlertNotificationChannel_status_idx` ON `AlertNotificationChannel`(`status`);
CREATE INDEX `AlertNotificationChannel_lastDeliveredAt_idx` ON `AlertNotificationChannel`(`lastDeliveredAt`);
CREATE INDEX `AlertNotificationDelivery_teamId_idx` ON `AlertNotificationDelivery`(`teamId`);
CREATE INDEX `AlertNotificationDelivery_channelId_idx` ON `AlertNotificationDelivery`(`channelId`);
CREATE INDEX `AlertNotificationDelivery_alertEventId_idx` ON `AlertNotificationDelivery`(`alertEventId`);
CREATE INDEX `AlertNotificationDelivery_channelType_idx` ON `AlertNotificationDelivery`(`channelType`);
CREATE INDEX `AlertNotificationDelivery_status_idx` ON `AlertNotificationDelivery`(`status`);
CREATE INDEX `AlertNotificationDelivery_createdAt_idx` ON `AlertNotificationDelivery`(`createdAt`);

-- AddForeignKey
ALTER TABLE `AlertNotificationChannel` ADD CONSTRAINT `AlertNotificationChannel_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertNotificationChannel` ADD CONSTRAINT `AlertNotificationChannel_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertNotificationDelivery` ADD CONSTRAINT `AlertNotificationDelivery_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertNotificationDelivery` ADD CONSTRAINT `AlertNotificationDelivery_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `AlertNotificationChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertNotificationDelivery` ADD CONSTRAINT `AlertNotificationDelivery_alertEventId_fkey` FOREIGN KEY (`alertEventId`) REFERENCES `AlertEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
