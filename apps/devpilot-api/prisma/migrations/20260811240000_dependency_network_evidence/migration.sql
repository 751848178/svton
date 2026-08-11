ALTER TABLE `ReleaseDependencyFetchRun`
  ADD COLUMN `dependencyNetworkMode` VARCHAR(191) NULL,
  ADD COLUMN `engineEvidenceDigest` VARCHAR(191) NULL;
