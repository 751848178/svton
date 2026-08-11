CREATE TABLE `ProductionPromotionCommand` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `releaseOrderId` VARCHAR(191) NOT NULL,
  `releaseRunId` VARCHAR(191) NOT NULL,
  `deploymentRunId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `candidateHash` VARCHAR(191) NOT NULL,
  `inputHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'running',
  `result` JSON NULL,
  `errorCode` VARCHAR(191) NULL,
  `errorMessage` TEXT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductionPromotionCommand_deploymentRunId_idempotencyKey_key`
    (`deploymentRunId`, `idempotencyKey`),
  INDEX `ProductionPromotionCommand_teamId_idx`(`teamId`),
  INDEX `ProductionPromotionCommand_projectId_idx`(`projectId`),
  INDEX `ProductionPromotionCommand_releaseOrderId_idx`(`releaseOrderId`),
  INDEX `ProductionPromotionCommand_releaseRunId_idx`(`releaseRunId`),
  INDEX `ProductionPromotionCommand_actorId_idx`(`actorId`),
  INDEX `ProductionPromotionCommand_status_idx`(`status`),
  INDEX `ProductionPromotionCommand_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductionPromotionCommand`
  ADD CONSTRAINT `ProductionPromotionCommand_teamId_fkey`
  FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionCommand_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionCommand_releaseOrderId_fkey`
  FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionCommand_releaseRunId_fkey`
  FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionCommand_deploymentRunId_fkey`
  FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionCommand_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
