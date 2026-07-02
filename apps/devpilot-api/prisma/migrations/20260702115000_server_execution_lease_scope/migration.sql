-- AlterTable
ALTER TABLE `ServerExecutionLease`
    ADD COLUMN `projectId` VARCHAR(191) NULL,
    ADD COLUMN `environmentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ServerExecutionLease_projectId_idx` ON `ServerExecutionLease`(`projectId`);
CREATE INDEX `ServerExecutionLease_environmentId_idx` ON `ServerExecutionLease`(`environmentId`);

-- AddForeignKey
ALTER TABLE `ServerExecutionLease`
    ADD CONSTRAINT `ServerExecutionLease_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServerExecutionLease`
    ADD CONSTRAINT `ServerExecutionLease_environmentId_fkey`
    FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
