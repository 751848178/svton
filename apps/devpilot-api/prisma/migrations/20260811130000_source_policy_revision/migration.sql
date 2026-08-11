ALTER TABLE `Project`
  ADD COLUMN `currentSourcePolicyRevisionId` VARCHAR(191) NULL;

CREATE TABLE `SourcePolicyRevision` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `revision` INTEGER NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `profileVersion` INTEGER NOT NULL,
  `externalRequiredChecks` INTEGER NOT NULL,
  `requiredIndependentApprovals` INTEGER NOT NULL,
  `snapshotHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SourcePolicyRevision_projectId_revision_key`(`projectId`, `revision`),
  UNIQUE INDEX `SourcePolicyRevision_projectId_profileId_profileVersion_key`(`projectId`, `profileId`, `profileVersion`),
  INDEX `SourcePolicyRevision_teamId_idx`(`teamId`),
  INDEX `SourcePolicyRevision_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Project_currentSourcePolicyRevisionId_key`
  ON `Project`(`currentSourcePolicyRevisionId`);

ALTER TABLE `SourcePolicyRevision`
  ADD CONSTRAINT `SourcePolicyRevision_teamId_fkey`
  FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SourcePolicyRevision`
  ADD CONSTRAINT `SourcePolicyRevision_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Project`
  ADD CONSTRAINT `Project_currentSourcePolicyRevisionId_fkey`
  FOREIGN KEY (`currentSourcePolicyRevisionId`) REFERENCES `SourcePolicyRevision`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
