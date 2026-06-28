-- AlterTable
ALTER TABLE `SiteSyncRun`
    ADD COLUMN `operationApprovalId` VARCHAR(191) NULL,
    ADD COLUMN `configDiff` JSON NULL;

-- CreateIndex
CREATE INDEX `SiteSyncRun_operationApprovalId_idx` ON `SiteSyncRun`(`operationApprovalId`);

-- AddForeignKey
ALTER TABLE `SiteSyncRun` ADD CONSTRAINT `SiteSyncRun_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
