CREATE TABLE `RepositoryIntakeReviewSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `runId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `inputHash` VARCHAR(64) NOT NULL,
  `snapshotHash` VARCHAR(64) NOT NULL,
  `branch` VARCHAR(191) NOT NULL,
  `commitSha` VARCHAR(64) NOT NULL,
  `parserVersion` VARCHAR(191) NOT NULL,
  `decisions` JSON NOT NULL,
  `references` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RepositoryIntakeReviewSnapshot_runId_key` (`runId`),
  UNIQUE INDEX `RepositoryIntakeReviewSnapshot_snapshotHash_key` (`snapshotHash`),
  INDEX `RepositoryIntakeReviewSnapshot_teamId_projectId_createdAt_idx` (`teamId`, `projectId`, `createdAt`),
  INDEX `RepositoryIntakeReviewSnapshot_actorId_idx` (`actorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RepositoryIntakeReviewSnapshot`
  ADD CONSTRAINT `RepositoryIntakeReviewSnapshot_teamId_fkey`
  FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RepositoryIntakeReviewSnapshot_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RepositoryIntakeReviewSnapshot_runId_fkey`
  FOREIGN KEY (`runId`) REFERENCES `RepositoryAnalysisRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RepositoryIntakeReviewSnapshot_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
