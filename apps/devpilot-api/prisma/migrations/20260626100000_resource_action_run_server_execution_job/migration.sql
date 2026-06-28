-- AlterTable
ALTER TABLE `ResourceActionRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ResourceActionRun_serverExecutionJobId_idx` ON `ResourceActionRun`(`serverExecutionJobId`);

-- AddForeignKey
ALTER TABLE `ResourceActionRun` ADD CONSTRAINT `ResourceActionRun_serverExecutionJobId_fkey` FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
