CREATE TABLE `ReleaseDependencyFetchRun` (
  `id` VARCHAR(191) NOT NULL,
  `combinationHash` VARCHAR(191) NOT NULL,
  `lockfileDigest` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `profileVersion` INTEGER NOT NULL,
  `pnpmVersion` VARCHAR(191) NOT NULL,
  `platformOs` VARCHAR(191) NOT NULL,
  `platformArch` VARCHAR(191) NOT NULL,
  `registryPolicyDigest` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
  `storeDigest` VARCHAR(191) NULL,
  `leaseToken` VARCHAR(191) NULL,
  `leasedAt` DATETIME(3) NULL,
  `errorCode` VARCHAR(191) NULL,
  `errorMessage` TEXT NULL,
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DependencyFetch_combination_key` (`combinationHash`),
  INDEX `DependencyFetch_status_lease_idx` (`status`, `leasedAt`),
  INDEX `DependencyFetch_lock_digest_idx` (`lockfileDigest`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BuildRun`
  ADD COLUMN `dependencyFetchRunId` VARCHAR(191) NULL,
  ADD COLUMN `dependencyStoreDigest` VARCHAR(191) NULL,
  ADD INDEX `BuildRun_dependency_fetch_idx` (`dependencyFetchRunId`),
  ADD CONSTRAINT `BuildRun_dependencyFetchRunId_fkey`
    FOREIGN KEY (`dependencyFetchRunId`)
    REFERENCES `ReleaseDependencyFetchRun` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
