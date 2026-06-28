-- CreateTable
CREATE TABLE `ResourceMetricSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `resourceActionRunId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `metricSource` VARCHAR(191) NOT NULL DEFAULT 'docker_stats',
    `status` VARCHAR(191) NOT NULL DEFAULT 'collected',
    `sampledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cpuPercent` DOUBLE NULL,
    `memoryUsageBytes` DOUBLE NULL,
    `memoryLimitBytes` DOUBLE NULL,
    `memoryPercent` DOUBLE NULL,
    `networkInputBytes` DOUBLE NULL,
    `networkOutputBytes` DOUBLE NULL,
    `blockInputBytes` DOUBLE NULL,
    `blockOutputBytes` DOUBLE NULL,
    `pids` INTEGER NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ResourceMetricSnapshot_teamId_idx` ON `ResourceMetricSnapshot`(`teamId`);
CREATE INDEX `ResourceMetricSnapshot_resourceId_idx` ON `ResourceMetricSnapshot`(`resourceId`);
CREATE INDEX `ResourceMetricSnapshot_resourceActionRunId_idx` ON `ResourceMetricSnapshot`(`resourceActionRunId`);
CREATE INDEX `ResourceMetricSnapshot_serverId_idx` ON `ResourceMetricSnapshot`(`serverId`);
CREATE INDEX `ResourceMetricSnapshot_projectId_idx` ON `ResourceMetricSnapshot`(`projectId`);
CREATE INDEX `ResourceMetricSnapshot_environmentId_idx` ON `ResourceMetricSnapshot`(`environmentId`);
CREATE INDEX `ResourceMetricSnapshot_sourceType_idx` ON `ResourceMetricSnapshot`(`sourceType`);
CREATE INDEX `ResourceMetricSnapshot_provider_idx` ON `ResourceMetricSnapshot`(`provider`);
CREATE INDEX `ResourceMetricSnapshot_kind_idx` ON `ResourceMetricSnapshot`(`kind`);
CREATE INDEX `ResourceMetricSnapshot_metricSource_idx` ON `ResourceMetricSnapshot`(`metricSource`);
CREATE INDEX `ResourceMetricSnapshot_status_idx` ON `ResourceMetricSnapshot`(`status`);
CREATE INDEX `ResourceMetricSnapshot_sampledAt_idx` ON `ResourceMetricSnapshot`(`sampledAt`);
CREATE INDEX `ResourceMetricSnapshot_resourceId_sampledAt_idx` ON `ResourceMetricSnapshot`(`resourceId`, `sampledAt`);

-- AddForeignKey
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ManagedResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_resourceActionRunId_fkey` FOREIGN KEY (`resourceActionRunId`) REFERENCES `ResourceActionRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `Server`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ResourceMetricSnapshot` ADD CONSTRAINT `ResourceMetricSnapshot_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
