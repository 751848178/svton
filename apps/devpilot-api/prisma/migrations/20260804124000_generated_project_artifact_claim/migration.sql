-- F414: persisted generated-artifact ownership and immutable selection.
CREATE TABLE `GeneratedProjectArtifactClaim` (
    `projectId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `ownerToken` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'claimed',
    `artifact` JSON NULL,
    `resolvedResources` JSON NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `selectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GeneratedProjectArtifactClaim_teamId_status_idx`(`teamId`, `status`),
    INDEX `GeneratedProjectArtifactClaim_leaseExpiresAt_idx`(`leaseExpiresAt`),
    PRIMARY KEY (`projectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GeneratedProjectArtifactClaim`
    ADD CONSTRAINT `GeneratedProjectArtifactClaim_projectId_fkey`
        FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
