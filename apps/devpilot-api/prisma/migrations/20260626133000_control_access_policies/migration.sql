-- CreateTable
CREATE TABLE `ControlAccessPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `principalUserId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `effect` VARCHAR(191) NOT NULL DEFAULT 'allow',
    `principalType` VARCHAR(191) NOT NULL DEFAULT 'team_role',
    `principalRole` VARCHAR(191) NULL,
    `categories` JSON NULL,
    `actions` JSON NULL,
    `riskLevels` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ControlAccessPolicy_teamId_idx` ON `ControlAccessPolicy`(`teamId`);
CREATE INDEX `ControlAccessPolicy_createdById_idx` ON `ControlAccessPolicy`(`createdById`);
CREATE INDEX `ControlAccessPolicy_principalUserId_idx` ON `ControlAccessPolicy`(`principalUserId`);
CREATE INDEX `ControlAccessPolicy_projectId_idx` ON `ControlAccessPolicy`(`projectId`);
CREATE INDEX `ControlAccessPolicy_environmentId_idx` ON `ControlAccessPolicy`(`environmentId`);
CREATE INDEX `ControlAccessPolicy_enabled_idx` ON `ControlAccessPolicy`(`enabled`);
CREATE INDEX `ControlAccessPolicy_effect_idx` ON `ControlAccessPolicy`(`effect`);
CREATE INDEX `ControlAccessPolicy_principalType_idx` ON `ControlAccessPolicy`(`principalType`);
CREATE INDEX `ControlAccessPolicy_principalRole_idx` ON `ControlAccessPolicy`(`principalRole`);
CREATE INDEX `ControlAccessPolicy_priority_idx` ON `ControlAccessPolicy`(`priority`);

-- AddForeignKey
ALTER TABLE `ControlAccessPolicy` ADD CONSTRAINT `ControlAccessPolicy_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ControlAccessPolicy` ADD CONSTRAINT `ControlAccessPolicy_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ControlAccessPolicy` ADD CONSTRAINT `ControlAccessPolicy_principalUserId_fkey` FOREIGN KEY (`principalUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ControlAccessPolicy` ADD CONSTRAINT `ControlAccessPolicy_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ControlAccessPolicy` ADD CONSTRAINT `ControlAccessPolicy_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
