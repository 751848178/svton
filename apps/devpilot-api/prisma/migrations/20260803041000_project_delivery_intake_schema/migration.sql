-- F387: additive project-intake and environment-baseline schema.
-- Legacy lifecycle/role columns intentionally have no default and remain NULL
-- until the preflight report proves an unambiguous backfill candidate.

ALTER TABLE `Project`
    ADD COLUMN `onboardingStatus` VARCHAR(191) NULL,
    ADD COLUMN `onboardingRevision` INTEGER NULL,
    ADD COLUMN `onboardingFinalizedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE INDEX `Project_onboardingStatus_idx` ON `Project`(`onboardingStatus`);
CREATE INDEX `Project_archivedAt_idx` ON `Project`(`archivedAt`);

CREATE TABLE `ProjectRepositoryIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `repositoryConnectionId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerRepositoryId` VARCHAR(191) NULL,
    `canonicalKey` VARCHAR(191) NOT NULL,
    `canonicalUrl` TEXT NOT NULL,
    `defaultBranch` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectRepositoryIdentity_projectId_key`(`projectId`),
    UNIQUE INDEX `ProjectRepositoryIdentity_repositoryConnectionId_key`(`repositoryConnectionId`),
    UNIQUE INDEX `ProjectRepositoryIdentity_teamId_canonicalKey_key`(`teamId`, `canonicalKey`),
    INDEX `ProjectRepositoryIdentity_teamId_idx`(`teamId`),
    INDEX `ProjectRepositoryIdentity_provider_providerRepositoryId_idx`(`provider`, `providerRepositoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProjectIntakeFinalization` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `analysisRunId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `resultSnapshot` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectIntakeFinalization_projectId_idempotencyKey_key`(`projectId`, `idempotencyKey`),
    INDEX `ProjectIntakeFinalization_teamId_idx`(`teamId`),
    INDEX `ProjectIntakeFinalization_analysisRunId_idx`(`analysisRunId`),
    INDEX `ProjectIntakeFinalization_actorId_idx`(`actorId`),
    INDEX `ProjectIntakeFinalization_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EnvironmentConfigRevision` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `revision` INTEGER NOT NULL,
    `snapshotHash` VARCHAR(191) NOT NULL,
    `plainVariables` JSON NULL,
    `secretReferences` JSON NULL,
    `resourceReferences` JSON NULL,
    `routeSnapshot` JSON NULL,
    `policyReferences` JSON NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'project_intake',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EnvironmentConfigRevision_environmentId_revision_key`(`environmentId`, `revision`),
    INDEX `EnvironmentConfigRevision_teamId_idx`(`teamId`),
    INDEX `EnvironmentConfigRevision_projectId_idx`(`projectId`),
    INDEX `EnvironmentConfigRevision_createdById_idx`(`createdById`),
    INDEX `EnvironmentConfigRevision_snapshotHash_idx`(`snapshotHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProjectEnvironment`
    ADD COLUMN `baselineRole` VARCHAR(191) NULL,
    ADD COLUMN `identityLockedAt` DATETIME(3) NULL,
    ADD COLUMN `currentConfigRevisionId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ProjectEnvironment_currentConfigRevisionId_key`
    ON `ProjectEnvironment`(`currentConfigRevisionId`);
CREATE UNIQUE INDEX `ProjectEnvironment_projectId_baselineRole_key`
    ON `ProjectEnvironment`(`projectId`, `baselineRole`);

ALTER TABLE `ProjectRepositoryIdentity`
    ADD CONSTRAINT `ProjectRepositoryIdentity_teamId_fkey`
        FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ProjectRepositoryIdentity_projectId_fkey`
        FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ProjectRepositoryIdentity_repositoryConnectionId_fkey`
        FOREIGN KEY (`repositoryConnectionId`) REFERENCES `RepositoryConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProjectIntakeFinalization`
    ADD CONSTRAINT `ProjectIntakeFinalization_teamId_fkey`
        FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ProjectIntakeFinalization_projectId_fkey`
        FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ProjectIntakeFinalization_analysisRunId_fkey`
        FOREIGN KEY (`analysisRunId`) REFERENCES `RepositoryAnalysisRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ProjectIntakeFinalization_actorId_fkey`
        FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EnvironmentConfigRevision`
    ADD CONSTRAINT `EnvironmentConfigRevision_teamId_fkey`
        FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `EnvironmentConfigRevision_projectId_fkey`
        FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `EnvironmentConfigRevision_environmentId_fkey`
        FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `EnvironmentConfigRevision_createdById_fkey`
        FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProjectEnvironment`
    ADD CONSTRAINT `ProjectEnvironment_currentConfigRevisionId_fkey`
        FOREIGN KEY (`currentConfigRevisionId`) REFERENCES `EnvironmentConfigRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
