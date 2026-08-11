ALTER TABLE `ReleaseDependencyFetchRun`
  ADD COLUMN `profileSnapshotHash` VARCHAR(191) NULL,
  ADD COLUMN `supplyChainDigest` VARCHAR(191) NULL,
  ADD COLUMN `fetchImage` VARCHAR(512) NULL,
  ADD COLUMN `jobImage` VARCHAR(512) NULL,
  ADD COLUMN `platformAbi` VARCHAR(191) NULL,
  ADD COLUMN `platformLibc` VARCHAR(191) NULL,
  ADD COLUMN `leaseTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `leaseExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `heartbeatAt` DATETIME(3) NULL;

DROP INDEX `DependencyFetch_status_lease_idx` ON `ReleaseDependencyFetchRun`;
CREATE INDEX `DependencyFetch_status_lease_idx`
  ON `ReleaseDependencyFetchRun` (`status`, `leaseExpiresAt`);

UPDATE `ReleaseDependencyFetchRun`
SET `status` = 'invalidated',
    `storeDigest` = NULL,
    `errorCode` = 'dependency_identity_upgrade_required',
    `finishedAt` = CURRENT_TIMESTAMP(3)
WHERE `status` <> 'succeeded'
   OR `profileSnapshotHash` IS NULL
   OR `supplyChainDigest` IS NULL
   OR `fetchImage` IS NULL
   OR `jobImage` IS NULL
   OR `platformAbi` IS NULL
   OR `platformLibc` IS NULL;

ALTER TABLE `ReleaseDependencyFetchRun` DROP COLUMN `leaseToken`;
