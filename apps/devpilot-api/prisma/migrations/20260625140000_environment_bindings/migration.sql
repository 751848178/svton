-- AlterTable
ALTER TABLE `Site` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DeploymentRun` ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Site_environmentId_idx` ON `Site`(`environmentId`);

-- CreateIndex
CREATE INDEX `DeploymentRun_environmentId_idx` ON `DeploymentRun`(`environmentId`);

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
