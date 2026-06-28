-- AlterTable
ALTER TABLE `SiteSyncRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `SiteSyncRun_serverExecutionJobId_idx` ON `SiteSyncRun`(`serverExecutionJobId`);

-- AddForeignKey
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_serverExecutionJobId_fkey` FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
