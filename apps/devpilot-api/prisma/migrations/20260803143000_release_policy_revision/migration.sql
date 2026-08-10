-- AlterTable
ALTER TABLE `Project`
    ADD COLUMN `currentReleasePolicyRevisionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ReleaseRun`
    ADD COLUMN `releasePolicyRevisionId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ReleasePolicyRevision` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `requireProductionApproval` BOOLEAN NOT NULL DEFAULT true,
    `changeWindow` JSON NULL,
    `freezePolicy` JSON NULL,
    `snapshotHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReleasePolicyRevision_teamId_idx`(`teamId`),
    INDEX `ReleasePolicyRevision_createdById_idx`(`createdById`),
    INDEX `ReleasePolicyRevision_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ReleasePolicyRevision_projectId_revision_key`(`projectId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Project_currentReleasePolicyRevisionId_key`
    ON `Project`(`currentReleasePolicyRevisionId`);

-- CreateIndex
CREATE INDEX `ReleaseRun_releasePolicyRevisionId_idx`
    ON `ReleaseRun`(`releasePolicyRevisionId`);

-- AddForeignKey
ALTER TABLE `ReleasePolicyRevision`
    ADD CONSTRAINT `ReleasePolicyRevision_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleasePolicyRevision`
    ADD CONSTRAINT `ReleasePolicyRevision_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleasePolicyRevision`
    ADD CONSTRAINT `ReleasePolicyRevision_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project`
    ADD CONSTRAINT `Project_currentReleasePolicyRevisionId_fkey`
    FOREIGN KEY (`currentReleasePolicyRevisionId`) REFERENCES `ReleasePolicyRevision`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun`
    ADD CONSTRAINT `ReleaseRun_releasePolicyRevisionId_fkey`
    FOREIGN KEY (`releasePolicyRevisionId`) REFERENCES `ReleasePolicyRevision`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
