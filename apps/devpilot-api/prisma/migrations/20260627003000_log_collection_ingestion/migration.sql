-- AlterTable
ALTER TABLE `LogCollectionRun`
    ADD COLUMN `ingestionStatus` VARCHAR(191) NULL,
    ADD COLUMN `ingestedEntryCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `ingestionError` TEXT NULL,
    ADD COLUMN `ingestedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `LogCollectionRun_ingestionStatus_idx` ON `LogCollectionRun`(`ingestionStatus`);
