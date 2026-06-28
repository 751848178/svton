-- AlterTable
ALTER TABLE `DeploymentRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `DeploymentRun_serverExecutionJobId_idx` ON `DeploymentRun`(`serverExecutionJobId`);

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_serverExecutionJobId_fkey` FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
