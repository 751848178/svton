ALTER TABLE `ReleaseDependencyFetchRun`
  ADD COLUMN `cacheGeneration` INTEGER NOT NULL DEFAULT 0;

UPDATE `ReleaseDependencyFetchRun`
SET `cacheGeneration` = 1
WHERE `status` = 'succeeded' AND `storeDigest` IS NOT NULL;

UPDATE `ReleaseDependencyFetchRun`
SET `storeDigest` = NULL
WHERE `status` = 'invalidated'
  AND `errorCode` = 'dependency_identity_upgrade_required';

ALTER TABLE `BuildRun`
  ADD COLUMN `dependencyStoreGeneration` INTEGER NULL;
