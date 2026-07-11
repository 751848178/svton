-- DropForeignKey
ALTER TABLE `Preset` DROP FOREIGN KEY `Preset_userId_fkey`;
ALTER TABLE `Project` DROP FOREIGN KEY `Project_userId_fkey`;
ALTER TABLE `Resource` DROP FOREIGN KEY `Resource_userId_fkey`;
ALTER TABLE `SecretKey` DROP FOREIGN KEY `SecretKey_userId_fkey`;
ALTER TABLE `ServerExecutionLease` DROP FOREIGN KEY `ServerExecutionLease_environmentId_fkey`;
ALTER TABLE `ServerExecutionLease` DROP FOREIGN KEY `ServerExecutionLease_projectId_fkey`;

-- DropIndex
DROP INDEX `Resource_userId_type_idx` ON `Resource`;

-- AlterTable
ALTER TABLE `Account` MODIFY `refresh_token` TEXT NULL,
    MODIFY `access_token` TEXT NULL;

-- AlterTable
ALTER TABLE `Preset` DROP COLUMN `userId`,
    ADD COLUMN `createdById` VARCHAR(191) NOT NULL,
    ADD COLUMN `teamId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Project` DROP COLUMN `domains`,
    DROP COLUMN `userId`,
    ADD COLUMN `createdById` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `teamId` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Resource` DROP COLUMN `userId`,
    ADD COLUMN `createdById` VARCHAR(191) NOT NULL,
    ADD COLUMN `teamId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ResourceAllocation` ADD COLUMN `teamId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `SecretKey` DROP COLUMN `userId`,
    ADD COLUMN `createdById` VARCHAR(191) NOT NULL,
    ADD COLUMN `teamId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ServerExecutionLease` DROP COLUMN `environmentId`,
    DROP COLUMN `projectId`;

-- CreateIndex
CREATE INDEX `Preset_teamId_idx` ON `Preset`(`teamId`);
CREATE INDEX `Project_teamId_idx` ON `Project`(`teamId`);
CREATE INDEX `Project_createdById_idx` ON `Project`(`createdById`);
CREATE INDEX `Resource_teamId_type_idx` ON `Resource`(`teamId`, `type`);
CREATE INDEX `ResourceAllocation_teamId_idx` ON `ResourceAllocation`(`teamId`);
CREATE INDEX `SecretKey_teamId_idx` ON `SecretKey`(`teamId`);

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Preset` ADD CONSTRAINT `Preset_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Preset` ADD CONSTRAINT `Preset_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Project` ADD CONSTRAINT `Project_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Project` ADD CONSTRAINT `Project_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecretKey` ADD CONSTRAINT `SecretKey_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecretKey` ADD CONSTRAINT `SecretKey_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecretKey` ADD CONSTRAINT `SecretKey_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
