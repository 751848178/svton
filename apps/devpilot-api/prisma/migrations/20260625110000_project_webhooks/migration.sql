-- CreateTable
CREATE TABLE `ProjectWebhook` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'github',
    `urlToken` VARCHAR(191) NOT NULL,
    `secret` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `eventTypes` JSON NULL,
    `branchPattern` VARCHAR(191) NULL,
    `tagPattern` VARCHAR(191) NULL,
    `lastDeliveryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectWebhook_urlToken_key`(`urlToken`),
    INDEX `ProjectWebhook_teamId_idx`(`teamId`),
    INDEX `ProjectWebhook_projectId_idx`(`projectId`),
    INDEX `ProjectWebhook_createdById_idx`(`createdById`),
    INDEX `ProjectWebhook_provider_idx`(`provider`),
    INDEX `ProjectWebhook_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `webhookId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `deploymentRunId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NULL,
    `sourceIp` VARCHAR(191) NULL,
    `signatureStatus` VARCHAR(191) NOT NULL DEFAULT 'unchecked',
    `payloadHash` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `message` TEXT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookDelivery_webhookId_idx`(`webhookId`),
    INDEX `WebhookDelivery_teamId_idx`(`teamId`),
    INDEX `WebhookDelivery_projectId_idx`(`projectId`),
    INDEX `WebhookDelivery_deploymentRunId_idx`(`deploymentRunId`),
    INDEX `WebhookDelivery_eventType_idx`(`eventType`),
    INDEX `WebhookDelivery_signatureStatus_idx`(`signatureStatus`),
    INDEX `WebhookDelivery_status_idx`(`status`),
    INDEX `WebhookDelivery_receivedAt_idx`(`receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectWebhook` ADD CONSTRAINT `ProjectWebhook_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectWebhook` ADD CONSTRAINT `ProjectWebhook_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectWebhook` ADD CONSTRAINT `ProjectWebhook_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_webhookId_fkey` FOREIGN KEY (`webhookId`) REFERENCES `ProjectWebhook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
