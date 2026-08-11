ALTER TABLE `ProductionPromotionCommand`
  ADD COLUMN `phase` VARCHAR(191) NOT NULL DEFAULT 'reserved',
  ADD COLUMN `leaseOwner` VARCHAR(191) NULL,
  ADD COLUMN `leaseTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `leaseExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `heartbeatAt` DATETIME(3) NULL,
  ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `preDecisionId` VARCHAR(191) NULL,
  ADD COLUMN `preDecisionInputHash` VARCHAR(191) NULL,
  ADD COLUMN `preDecisionActionHash` VARCHAR(191) NULL,
  ADD COLUMN `postDecisionId` VARCHAR(191) NULL,
  ADD COLUMN `postDecisionInputHash` VARCHAR(191) NULL,
  ADD COLUMN `postDecisionActionHash` VARCHAR(191) NULL,
  ADD COLUMN `routeSwitchOperationId` VARCHAR(191) NULL,
  ADD COLUMN `observationRecordedAt` DATETIME(3) NULL;

CREATE INDEX `ProductionPromotionCommand_status_lease_idx`
  ON `ProductionPromotionCommand`(`status`, `leaseExpiresAt`);
CREATE INDEX `ProductionPromotionCommand_lease_owner_idx`
  ON `ProductionPromotionCommand`(`leaseOwner`);
CREATE INDEX `ProductionPromotionCommand_route_operation_idx`
  ON `ProductionPromotionCommand`(`routeSwitchOperationId`);

ALTER TABLE `SiteRouteSwitchRun`
  ADD COLUMN `promotionCandidateHash` VARCHAR(191) NULL,
  ADD COLUMN `promotionObservedAt` DATETIME(3) NULL,
  ADD COLUMN `promotionProbeHash` VARCHAR(191) NULL,
  ADD COLUMN `promotionObservation` JSON NULL;

CREATE INDEX `SiteRouteSwitchRun_deployment_candidate_idx`
  ON `SiteRouteSwitchRun`(`deploymentRunId`, `promotionCandidateHash`);
