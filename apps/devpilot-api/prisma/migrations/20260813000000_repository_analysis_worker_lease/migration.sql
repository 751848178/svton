ALTER TABLE `RepositoryAnalysisRun`
  ADD COLUMN `workerLeaseToken` VARCHAR(64) NULL,
  ADD COLUMN `workerLeaseExpiresAt` DATETIME(3) NULL;

UPDATE `RepositoryAnalysisRun`
SET `workerLeaseExpiresAt` = CURRENT_TIMESTAMP(3)
WHERE `status` = 'running' AND `workerLeaseExpiresAt` IS NULL;

CREATE INDEX `RepositoryAnalysisRun_workerLeaseExpiresAt_idx`
  ON `RepositoryAnalysisRun`(`workerLeaseExpiresAt`);
