-- CreateTable
CREATE TABLE `AlertSilence` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `category` VARCHAR(191) NULL,
    `metric` VARCHAR(191) NULL,
    `severityFilter` JSON NULL,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AlertSilence_teamId_idx` ON `AlertSilence`(`teamId`);
CREATE INDEX `AlertSilence_createdById_idx` ON `AlertSilence`(`createdById`);
CREATE INDEX `AlertSilence_projectId_idx` ON `AlertSilence`(`projectId`);
CREATE INDEX `AlertSilence_environmentId_idx` ON `AlertSilence`(`environmentId`);
CREATE INDEX `AlertSilence_status_idx` ON `AlertSilence`(`status`);
CREATE INDEX `AlertSilence_category_idx` ON `AlertSilence`(`category`);
CREATE INDEX `AlertSilence_metric_idx` ON `AlertSilence`(`metric`);
CREATE INDEX `AlertSilence_startsAt_idx` ON `AlertSilence`(`startsAt`);
CREATE INDEX `AlertSilence_endsAt_idx` ON `AlertSilence`(`endsAt`);

-- AddForeignKey
ALTER TABLE `AlertSilence` ADD CONSTRAINT `AlertSilence_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AlertSilence` ADD CONSTRAINT `AlertSilence_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertSilence` ADD CONSTRAINT `AlertSilence_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AlertSilence` ADD CONSTRAINT `AlertSilence_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
