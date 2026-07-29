-- CreateTable: 并发键租约（F383 D2）—— 唯一键原子保证同 concurrencyKey 单一活跃阶段
CREATE TABLE `ReleaseConcurrencyLease` (
    `id` VARCHAR(191) NOT NULL,
    `concurrencyKey` VARCHAR(191) NOT NULL,
    `releaseStageId` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `heartbeatAt` DATETIME(3) NULL,

    UNIQUE INDEX `release_concurrency_lease_key`(`concurrencyKey`),
    INDEX `ReleaseConcurrencyLease_releaseStageId_idx`(`releaseStageId`),
    INDEX `ReleaseConcurrencyLease_expiresAt_idx`(`expiresAt`),
    INDEX `ReleaseConcurrencyLease_owner_idx`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReleaseConcurrencyLease` ADD CONSTRAINT `ReleaseConcurrencyLease_releaseStageId_fkey` FOREIGN KEY (`releaseStageId`) REFERENCES `ReleaseStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
