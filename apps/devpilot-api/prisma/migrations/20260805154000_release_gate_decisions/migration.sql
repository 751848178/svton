-- CreateTable
CREATE TABLE `ReleaseGateDecision` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `stage` VARCHAR(191) NOT NULL,
    `phase` VARCHAR(191) NOT NULL,
    `allowed` BOOLEAN NOT NULL,
    `definitionVersion` VARCHAR(191) NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(191) NULL,
    `inputSnapshot` JSON NOT NULL,
    `blockerGateIds` JSON NOT NULL,
    `manualGateIds` JSON NOT NULL,
    `confirmedManualGateIds` JSON NOT NULL,
    `warningGateIds` JSON NOT NULL,
    `deferredGateIds` JSON NOT NULL,
    `evidenceOnlyGateIds` JSON NOT NULL,
    `integrityErrors` JSON NOT NULL,
    `actionRunType` VARCHAR(191) NULL,
    `actionRunId` VARCHAR(191) NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReleaseGateDecision_teamId_idx`(`teamId`),
    INDEX `ReleaseGateDecision_projectId_idx`(`projectId`),
    INDEX `ReleaseGateDecision_actorId_idx`(`actorId`),
    INDEX `ReleaseGateDecision_stage_allowed_idx`(`stage`, `allowed`),
    INDEX `ReleaseGateDecision_createdAt_idx`(`createdAt`),
    INDEX `ReleaseGateDecision_releaseOrderId_stage_inputHash_idx`(`releaseOrderId`, `stage`, `inputHash`),
    INDEX `ReleaseGateDecision_actionRunType_actionRunId_idx`(`actionRunType`, `actionRunId`),
    UNIQUE INDEX `ReleaseGateDecision_releaseOrderId_stage_requestKey_key`(`releaseOrderId`, `stage`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReleaseGateDecision` ADD CONSTRAINT `ReleaseGateDecision_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseGateDecision` ADD CONSTRAINT `ReleaseGateDecision_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseGateDecision` ADD CONSTRAINT `ReleaseGateDecision_releaseOrderId_fkey`
    FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseGateDecision` ADD CONSTRAINT `ReleaseGateDecision_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
