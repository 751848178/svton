-- CreateTable
CREATE TABLE `GateEvaluation` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `releaseRunId` VARCHAR(191) NULL,
    `buildRunId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `gateId` VARCHAR(191) NOT NULL,
    `definitionVersion` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `providerKey` VARCHAR(191) NULL,
    `reasonCode` VARCHAR(191) NOT NULL,
    `summary` JSON NULL,
    `evidenceRef` TEXT NULL,
    `checkedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `sourceSystem` VARCHAR(191) NOT NULL,
    `waiver` JSON NULL,
    `waiverExpiresAt` DATETIME(3) NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GateEvaluation_teamId_idx`(`teamId`),
    INDEX `GateEvaluation_projectId_idx`(`projectId`),
    INDEX `GateEvaluation_releaseRunId_idx`(`releaseRunId`),
    INDEX `GateEvaluation_buildRunId_idx`(`buildRunId`),
    INDEX `GateEvaluation_actorId_idx`(`actorId`),
    INDEX `GateEvaluation_status_idx`(`status`),
    INDEX `GateEvaluation_expiresAt_idx`(`expiresAt`),
    INDEX `GateEvaluation_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `GateEvaluation_releaseOrderId_gateId_inputHash_key`(`releaseOrderId`, `gateId`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_releaseOrderId_fkey`
    FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_releaseRunId_fkey`
    FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_buildRunId_fkey`
    FOREIGN KEY (`buildRunId`) REFERENCES `BuildRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateEvaluation` ADD CONSTRAINT `GateEvaluation_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
