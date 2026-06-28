-- CreateTable
CREATE TABLE `ServerCommandPolicyTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `adapterKeys` JSON NULL,
    `operationKeys` JSON NULL,
    `allowedPatterns` JSON NULL,
    `blockedPatterns` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ServerCommandPolicyTemplate_teamId_idx` ON `ServerCommandPolicyTemplate`(`teamId`);
CREATE INDEX `ServerCommandPolicyTemplate_createdById_idx` ON `ServerCommandPolicyTemplate`(`createdById`);
CREATE INDEX `ServerCommandPolicyTemplate_projectId_idx` ON `ServerCommandPolicyTemplate`(`projectId`);
CREATE INDEX `ServerCommandPolicyTemplate_environmentId_idx` ON `ServerCommandPolicyTemplate`(`environmentId`);
CREATE INDEX `ServerCommandPolicyTemplate_enabled_idx` ON `ServerCommandPolicyTemplate`(`enabled`);
CREATE INDEX `ServerCommandPolicyTemplate_priority_idx` ON `ServerCommandPolicyTemplate`(`priority`);

-- AddForeignKey
ALTER TABLE `ServerCommandPolicyTemplate` ADD CONSTRAINT `ServerCommandPolicyTemplate_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServerCommandPolicyTemplate` ADD CONSTRAINT `ServerCommandPolicyTemplate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServerCommandPolicyTemplate` ADD CONSTRAINT `ServerCommandPolicyTemplate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServerCommandPolicyTemplate` ADD CONSTRAINT `ServerCommandPolicyTemplate_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
