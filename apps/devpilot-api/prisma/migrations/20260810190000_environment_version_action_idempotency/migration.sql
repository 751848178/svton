ALTER TABLE `DeploymentRun`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
  ADD COLUMN `inputHash` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `deployment_run_project_idempotency`
  ON `DeploymentRun`(`projectId`, `idempotencyKey`);
