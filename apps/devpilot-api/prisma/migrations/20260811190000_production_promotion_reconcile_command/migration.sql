CREATE TABLE `ProductionPromotionReconcileCommand` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `releaseOrderId` VARCHAR(191) NOT NULL,
  `releaseRunId` VARCHAR(191) NOT NULL,
  `deploymentRunId` VARCHAR(191) NOT NULL,
  `promotionCommandId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `inputHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'running',
  `readbackState` VARCHAR(191) NULL,
  `routeSwitchOperationId` VARCHAR(191) NULL,
  `routeProviderKey` VARCHAR(191) NULL,
  `result` JSON NULL,
  `errorCode` VARCHAR(191) NULL,
  `errorMessage` TEXT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `prod_promo_reconcile_command_idem_key`(`promotionCommandId`, `idempotencyKey`),
  INDEX `ProductionPromotionReconcileCommand_teamId_idx`(`teamId`),
  INDEX `ProductionPromotionReconcileCommand_projectId_idx`(`projectId`),
  INDEX `ProductionPromotionReconcileCommand_releaseOrderId_idx`(`releaseOrderId`),
  INDEX `ProductionPromotionReconcileCommand_releaseRunId_idx`(`releaseRunId`),
  INDEX `ProductionPromotionReconcileCommand_deploymentRunId_idx`(`deploymentRunId`),
  INDEX `ProductionPromotionReconcileCommand_actorId_idx`(`actorId`),
  INDEX `ProductionPromotionReconcileCommand_status_idx`(`status`),
  INDEX `ProductionPromotionReconcileCommand_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductionPromotionReconcileCommand`
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_releaseOrderId_fkey`
    FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_releaseRunId_fkey`
    FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_deploymentRunId_fkey`
    FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_promotionCommandId_fkey`
    FOREIGN KEY (`promotionCommandId`) REFERENCES `ProductionPromotionCommand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionPromotionReconcileCommand_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
