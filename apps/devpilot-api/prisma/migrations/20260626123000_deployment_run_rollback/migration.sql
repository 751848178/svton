-- Track DeploymentRun rollback runs and their source deployment.
ALTER TABLE `DeploymentRun`
  ADD COLUMN `sourceRunId` VARCHAR(191) NULL,
  ADD COLUMN `mode` VARCHAR(191) NOT NULL DEFAULT 'deploy';

CREATE INDEX `DeploymentRun_sourceRunId_idx` ON `DeploymentRun`(`sourceRunId`);
CREATE INDEX `DeploymentRun_mode_idx` ON `DeploymentRun`(`mode`);

ALTER TABLE `DeploymentRun`
  ADD CONSTRAINT `DeploymentRun_sourceRunId_fkey`
  FOREIGN KEY (`sourceRunId`) REFERENCES `DeploymentRun`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
