ALTER TABLE `ProductionPromotionCommand`
  ADD COLUMN `legacyReconcileRequired` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `legacyReconcileReason` VARCHAR(191) NULL;

UPDATE `ProductionPromotionCommand`
SET
  `legacyReconcileRequired` = true,
  `legacyReconcileReason` = 'pre_lease_phase_unverifiable',
  `phase` = 'legacy_reconcile_required'
WHERE `status` = 'running'
  AND `attemptCount` = 0;

UPDATE `ProductionPromotionCommand`
SET `phase` = 'committing'
WHERE `status` = 'completed'
  AND `attemptCount` = 0
  AND `phase` = 'reserved';

CREATE INDEX `ProductionPromotionCommand_legacy_reconcile_idx`
  ON `ProductionPromotionCommand`(`legacyReconcileRequired`, `status`);
