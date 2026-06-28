-- AlterTable
ALTER TABLE `ServerExecutionJob`
    ADD COLUMN `lockExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `recoveredAt` DATETIME(3) NULL,
    ADD COLUMN `recoveryReason` TEXT NULL,
    ADD COLUMN `recoveryCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `ServerExecutionJob_lockExpiresAt_idx` ON `ServerExecutionJob`(`lockExpiresAt`);
CREATE INDEX `ServerExecutionJob_recoveredAt_idx` ON `ServerExecutionJob`(`recoveredAt`);
