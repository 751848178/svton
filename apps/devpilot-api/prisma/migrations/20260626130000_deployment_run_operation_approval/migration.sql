-- Link live deployment runs to operation approvals.
ALTER TABLE `DeploymentRun`
  ADD COLUMN `operationApprovalId` VARCHAR(191) NULL;

CREATE INDEX `DeploymentRun_operationApprovalId_idx` ON `DeploymentRun`(`operationApprovalId`);

ALTER TABLE `DeploymentRun`
  ADD CONSTRAINT `DeploymentRun_operationApprovalId_fkey`
  FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
