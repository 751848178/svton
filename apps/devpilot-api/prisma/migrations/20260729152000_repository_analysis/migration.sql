-- F384: verified repository connections, immutable analysis runs, stage evidence,
-- and explicit review/apply suggestions.

CREATE TABLE `RepositoryConnection` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `connectedById` VARCHAR(191) NULL,
    `gitConnectionId` VARCHAR(191) NULL,
    `teamCredentialId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'generic',
    `repositoryUrl` TEXT NOT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'public',
    `credentialSource` VARCHAR(191) NOT NULL DEFAULT 'none',
    `externalRepositoryId` VARCHAR(191) NULL,
    `defaultBranch` VARCHAR(191) NULL,
    `selectedBranch` VARCHAR(191) NULL,
    `commitSha` VARCHAR(191) NULL,
    `branches` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `verifiedAt` DATETIME(3) NULL,
    `lastAppliedRunId` VARCHAR(191) NULL,
    `appliedAt` DATETIME(3) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RepositoryConnection_projectId_key`(`projectId`),
    INDEX `RepositoryConnection_teamId_idx`(`teamId`),
    INDEX `RepositoryConnection_connectedById_idx`(`connectedById`),
    INDEX `RepositoryConnection_gitConnectionId_idx`(`gitConnectionId`),
    INDEX `RepositoryConnection_teamCredentialId_idx`(`teamCredentialId`),
    INDEX `RepositoryConnection_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RepositoryAnalysisRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `triggeredById` VARCHAR(191) NULL,
    `retryOfId` VARCHAR(191) NULL,
    `repositoryUrl` TEXT NOT NULL,
    `branch` VARCHAR(191) NOT NULL,
    `commitSha` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `activeKey` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `currentStage` VARCHAR(191) NULL,
    `parserVersion` VARCHAR(191) NOT NULL,
    `summary` JSON NULL,
    `result` JSON NULL,
    `warnings` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `errorAction` TEXT NULL,
    `cancelRequestedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RepositoryAnalysisRun_projectId_idempotencyKey_key`(`projectId`, `idempotencyKey`),
    UNIQUE INDEX `RepositoryAnalysisRun_projectId_activeKey_key`(`projectId`, `activeKey`),
    INDEX `RepositoryAnalysisRun_teamId_idx`(`teamId`),
    INDEX `RepositoryAnalysisRun_connectionId_idx`(`connectionId`),
    INDEX `RepositoryAnalysisRun_triggeredById_idx`(`triggeredById`),
    INDEX `RepositoryAnalysisRun_retryOfId_idx`(`retryOfId`),
    INDEX `RepositoryAnalysisRun_status_idx`(`status`),
    INDEX `RepositoryAnalysisRun_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RepositoryAnalysisStage` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ordinal` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `logs` JSON NULL,
    `evidence` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RepositoryAnalysisStage_runId_name_key`(`runId`, `name`),
    INDEX `RepositoryAnalysisStage_runId_ordinal_idx`(`runId`, `ordinal`),
    INDEX `RepositoryAnalysisStage_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RepositoryAnalysisSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `key` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `confidence` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `conflict` BOOLEAN NOT NULL DEFAULT false,
    `impact` TEXT NULL,
    `currentValue` JSON NULL,
    `proposedValue` JSON NOT NULL,
    `reviewedValue` JSON NULL,
    `evidence` JSON NULL,
    `warnings` JSON NULL,
    `appliedRefs` JSON NULL,
    `reviewedAt` DATETIME(3) NULL,
    `appliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RepositoryAnalysisSuggestion_runId_key_key`(`runId`, `key`),
    INDEX `RepositoryAnalysisSuggestion_runId_status_idx`(`runId`, `status`),
    INDEX `RepositoryAnalysisSuggestion_reviewedById_idx`(`reviewedById`),
    INDEX `RepositoryAnalysisSuggestion_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RepositoryConnection`
    ADD CONSTRAINT `RepositoryConnection_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryConnection_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryConnection_connectedById_fkey`
    FOREIGN KEY (`connectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryConnection_gitConnectionId_fkey`
    FOREIGN KEY (`gitConnectionId`) REFERENCES `GitConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryConnection_teamCredentialId_fkey`
    FOREIGN KEY (`teamCredentialId`) REFERENCES `TeamCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RepositoryAnalysisRun`
    ADD CONSTRAINT `RepositoryAnalysisRun_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryAnalysisRun_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryAnalysisRun_connectionId_fkey`
    FOREIGN KEY (`connectionId`) REFERENCES `RepositoryConnection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryAnalysisRun_triggeredById_fkey`
    FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryAnalysisRun_retryOfId_fkey`
    FOREIGN KEY (`retryOfId`) REFERENCES `RepositoryAnalysisRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RepositoryAnalysisStage`
    ADD CONSTRAINT `RepositoryAnalysisStage_runId_fkey`
    FOREIGN KEY (`runId`) REFERENCES `RepositoryAnalysisRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `RepositoryAnalysisSuggestion`
    ADD CONSTRAINT `RepositoryAnalysisSuggestion_runId_fkey`
    FOREIGN KEY (`runId`) REFERENCES `RepositoryAnalysisRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `RepositoryAnalysisSuggestion_reviewedById_fkey`
    FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
