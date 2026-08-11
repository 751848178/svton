ALTER TABLE `SourcePolicyRevision`
  ADD COLUMN `snapshotVersion` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `snapshot` JSON NULL;

UPDATE `SourcePolicyRevision`
SET `snapshot` = JSON_OBJECT(
  'schemaVersion', 1,
  'profileId', `profileId`,
  'profileVersion', `profileVersion`,
  'externalRequiredChecks', `externalRequiredChecks`,
  'requiredIndependentApprovals', `requiredIndependentApprovals`
)
WHERE `snapshot` IS NULL;

ALTER TABLE `SourcePolicyRevision`
  MODIFY COLUMN `snapshot` JSON NOT NULL,
  DROP INDEX `SourcePolicyRevision_projectId_profileId_profileVersion_key`,
  ADD UNIQUE INDEX `SourcePolicyRevision_profile_snapshot_key`
    (`projectId`, `profileId`, `profileVersion`, `snapshotHash`);

CREATE TABLE `GateManualApproval` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `releaseOrderId` VARCHAR(191) NOT NULL,
  `gateEvaluationId` VARCHAR(191) NOT NULL,
  `evaluationInputHash` VARCHAR(191) NOT NULL,
  `actionInputHash` VARCHAR(191) NOT NULL,
  `requesterActorId` VARCHAR(191) NOT NULL,
  `reviewerActorId` VARCHAR(191) NOT NULL,
  `sourcePolicyRevisionId` VARCHAR(191) NULL,
  `sourcePolicySnapshotHash` VARCHAR(191) NULL,
  `sourceCommitSha` VARCHAR(191) NULL,
  `reason` TEXT NOT NULL,
  `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `GateManualApproval_evaluation_action_reviewer_key`
    (`gateEvaluationId`, `evaluationInputHash`, `actionInputHash`, `reviewerActorId`),
  INDEX `GateManualApproval_teamId_idx`(`teamId`),
  INDEX `GateManualApproval_projectId_idx`(`projectId`),
  INDEX `GateManualApproval_releaseOrderId_idx`(`releaseOrderId`),
  INDEX `GateManualApproval_sourcePolicyRevisionId_idx`(`sourcePolicyRevisionId`),
  INDEX `GateManualApproval_actionInputHash_idx`(`actionInputHash`),
  INDEX `GateManualApproval_expiresAt_idx`(`expiresAt`),
  INDEX `GateManualApproval_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GateManualApproval`
  ADD CONSTRAINT `GateManualApproval_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_releaseOrderId_fkey`
    FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_gateEvaluationId_fkey`
    FOREIGN KEY (`gateEvaluationId`) REFERENCES `GateEvaluation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_sourcePolicyRevisionId_fkey`
    FOREIGN KEY (`sourcePolicyRevisionId`) REFERENCES `SourcePolicyRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_requesterActorId_fkey`
    FOREIGN KEY (`requesterActorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `GateManualApproval_reviewerActorId_fkey`
    FOREIGN KEY (`reviewerActorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
