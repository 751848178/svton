-- AlterTable
ALTER TABLE `ServerExecutionJob`
    ADD COLUMN `queueMode` VARCHAR(191) NOT NULL DEFAULT 'inline',
    ADD COLUMN `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `lockOwner` VARCHAR(191) NULL,
    ADD COLUMN `lastHeartbeatAt` DATETIME(3) NULL,
    ADD COLUMN `cancelRequestedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `ServerExecutionJob_queueMode_idx` ON `ServerExecutionJob`(`queueMode`);
CREATE INDEX `ServerExecutionJob_availableAt_idx` ON `ServerExecutionJob`(`availableAt`);
CREATE INDEX `ServerExecutionJob_lockedAt_idx` ON `ServerExecutionJob`(`lockedAt`);
CREATE INDEX `ServerExecutionJob_lockOwner_idx` ON `ServerExecutionJob`(`lockOwner`);
CREATE INDEX `ServerExecutionJob_cancelRequestedAt_idx` ON `ServerExecutionJob`(`cancelRequestedAt`);
