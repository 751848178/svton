-- AlterTable
ALTER TABLE `DeploymentRun` ADD COLUMN `artifactManifestId` VARCHAR(191) NULL,
    ADD COLUMN `releaseRunId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ProjectEnvironment` ADD COLUMN `currentEnvironmentVersionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ReleasePlan` ADD COLUMN `releaseOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ReleaseStageAttempt` ADD COLUMN `buildRunId` VARCHAR(191) NULL,
    ADD COLUMN `releaseRunId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ReleaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseVersion` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReleaseOrder_teamId_idx`(`teamId`),
    INDEX `ReleaseOrder_createdById_idx`(`createdById`),
    INDEX `ReleaseOrder_status_idx`(`status`),
    INDEX `ReleaseOrder_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ReleaseOrder_projectId_releaseVersion_key`(`projectId`, `releaseVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuildRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `triggeredById` VARCHAR(191) NULL,
    `revision` INTEGER NOT NULL,
    `sourceBranch` VARCHAR(191) NOT NULL,
    `sourceCommitSha` VARCHAR(191) NOT NULL,
    `inputSnapshot` JSON NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `logReference` VARCHAR(191) NULL,
    `logSummary` JSON NULL,
    `gateSummary` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BuildRun_teamId_idx`(`teamId`),
    INDEX `BuildRun_projectId_idx`(`projectId`),
    INDEX `BuildRun_triggeredById_idx`(`triggeredById`),
    INDEX `BuildRun_sourceCommitSha_idx`(`sourceCommitSha`),
    INDEX `BuildRun_status_idx`(`status`),
    INDEX `BuildRun_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `BuildRun_releaseOrderId_revision_key`(`releaseOrderId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtifactManifest` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `buildRunId` VARCHAR(191) NOT NULL,
    `digest` VARCHAR(191) NOT NULL,
    `provenance` JSON NULL,
    `sbom` JSON NULL,
    `signature` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ArtifactManifest_buildRunId_key`(`buildRunId`),
    INDEX `ArtifactManifest_teamId_idx`(`teamId`),
    INDEX `ArtifactManifest_projectId_digest_idx`(`projectId`, `digest`),
    INDEX `ArtifactManifest_releaseOrderId_idx`(`releaseOrderId`),
    INDEX `ArtifactManifest_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtifactManifestItem` (
    `id` VARCHAR(191) NOT NULL,
    `manifestId` VARCHAR(191) NOT NULL,
    `componentKey` VARCHAR(191) NOT NULL,
    `artifactType` VARCHAR(191) NOT NULL,
    `uri` TEXT NOT NULL,
    `digest` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ArtifactManifestItem_digest_idx`(`digest`),
    UNIQUE INDEX `ArtifactManifestItem_manifestId_componentKey_key`(`manifestId`, `componentKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReleaseRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `artifactManifestId` VARCHAR(191) NOT NULL,
    `releasePlanId` VARCHAR(191) NULL,
    `configRevisionId` VARCHAR(191) NULL,
    `operationApprovalId` VARCHAR(191) NULL,
    `sourceReleaseRunId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `verifiedDigest` VARCHAR(191) NOT NULL,
    `resourceSnapshot` JSON NULL,
    `routeSnapshot` JSON NULL,
    `policySnapshot` JSON NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReleaseRun_teamId_idx`(`teamId`),
    INDEX `ReleaseRun_projectId_idx`(`projectId`),
    INDEX `ReleaseRun_environmentId_idx`(`environmentId`),
    INDEX `ReleaseRun_artifactManifestId_idx`(`artifactManifestId`),
    INDEX `ReleaseRun_releasePlanId_idx`(`releasePlanId`),
    INDEX `ReleaseRun_configRevisionId_idx`(`configRevisionId`),
    INDEX `ReleaseRun_operationApprovalId_idx`(`operationApprovalId`),
    INDEX `ReleaseRun_sourceReleaseRunId_idx`(`sourceReleaseRunId`),
    INDEX `ReleaseRun_actorId_idx`(`actorId`),
    INDEX `ReleaseRun_status_idx`(`status`),
    INDEX `ReleaseRun_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ReleaseRun_releaseOrderId_idempotencyKey_key`(`releaseOrderId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnvironmentVersion` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `releaseOrderId` VARCHAR(191) NOT NULL,
    `artifactManifestId` VARCHAR(191) NOT NULL,
    `deploymentRunId` VARCHAR(191) NOT NULL,
    `releaseRunId` VARCHAR(191) NULL,
    `previousVersionId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'deploy',
    `effectiveAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EnvironmentVersion_deploymentRunId_key`(`deploymentRunId`),
    UNIQUE INDEX `EnvironmentVersion_releaseRunId_key`(`releaseRunId`),
    INDEX `EnvironmentVersion_teamId_idx`(`teamId`),
    INDEX `EnvironmentVersion_projectId_idx`(`projectId`),
    INDEX `EnvironmentVersion_environmentId_effectiveAt_idx`(`environmentId`, `effectiveAt`),
    INDEX `EnvironmentVersion_releaseOrderId_idx`(`releaseOrderId`),
    INDEX `EnvironmentVersion_artifactManifestId_idx`(`artifactManifestId`),
    INDEX `EnvironmentVersion_previousVersionId_idx`(`previousVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DeploymentRun_artifactManifestId_idx` ON `DeploymentRun`(`artifactManifestId`);

-- CreateIndex
CREATE INDEX `DeploymentRun_releaseRunId_idx` ON `DeploymentRun`(`releaseRunId`);

-- CreateIndex
CREATE UNIQUE INDEX `ProjectEnvironment_currentEnvironmentVersionId_key` ON `ProjectEnvironment`(`currentEnvironmentVersionId`);

-- CreateIndex
CREATE INDEX `ReleasePlan_releaseOrderId_idx` ON `ReleasePlan`(`releaseOrderId`);

-- CreateIndex
CREATE UNIQUE INDEX `ReleaseStageAttempt_buildRunId_key` ON `ReleaseStageAttempt`(`buildRunId`);

-- CreateIndex
CREATE UNIQUE INDEX `ReleaseStageAttempt_releaseRunId_key` ON `ReleaseStageAttempt`(`releaseRunId`);

-- AddForeignKey
ALTER TABLE `ProjectEnvironment` ADD CONSTRAINT `ProjectEnvironment_currentEnvironmentVersionId_fkey` FOREIGN KEY (`currentEnvironmentVersionId`) REFERENCES `EnvironmentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_artifactManifestId_fkey` FOREIGN KEY (`artifactManifestId`) REFERENCES `ArtifactManifest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeploymentRun` ADD CONSTRAINT `DeploymentRun_releaseRunId_fkey` FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseOrder` ADD CONSTRAINT `ReleaseOrder_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseOrder` ADD CONSTRAINT `ReleaseOrder_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseOrder` ADD CONSTRAINT `ReleaseOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BuildRun` ADD CONSTRAINT `BuildRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BuildRun` ADD CONSTRAINT `BuildRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BuildRun` ADD CONSTRAINT `BuildRun_releaseOrderId_fkey` FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BuildRun` ADD CONSTRAINT `BuildRun_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactManifest` ADD CONSTRAINT `ArtifactManifest_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactManifest` ADD CONSTRAINT `ArtifactManifest_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactManifest` ADD CONSTRAINT `ArtifactManifest_releaseOrderId_fkey` FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactManifest` ADD CONSTRAINT `ArtifactManifest_buildRunId_fkey` FOREIGN KEY (`buildRunId`) REFERENCES `BuildRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtifactManifestItem` ADD CONSTRAINT `ArtifactManifestItem_manifestId_fkey` FOREIGN KEY (`manifestId`) REFERENCES `ArtifactManifest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_releaseOrderId_fkey` FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_artifactManifestId_fkey` FOREIGN KEY (`artifactManifestId`) REFERENCES `ArtifactManifest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_releasePlanId_fkey` FOREIGN KEY (`releasePlanId`) REFERENCES `ReleasePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_configRevisionId_fkey` FOREIGN KEY (`configRevisionId`) REFERENCES `EnvironmentConfigRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_sourceReleaseRunId_fkey` FOREIGN KEY (`sourceReleaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseRun` ADD CONSTRAINT `ReleaseRun_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_releaseOrderId_fkey` FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_artifactManifestId_fkey` FOREIGN KEY (`artifactManifestId`) REFERENCES `ArtifactManifest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_releaseRunId_fkey` FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentVersion` ADD CONSTRAINT `EnvironmentVersion_previousVersionId_fkey` FOREIGN KEY (`previousVersionId`) REFERENCES `EnvironmentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleasePlan` ADD CONSTRAINT `ReleasePlan_releaseOrderId_fkey` FOREIGN KEY (`releaseOrderId`) REFERENCES `ReleaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_buildRunId_fkey` FOREIGN KEY (`buildRunId`) REFERENCES `BuildRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_releaseRunId_fkey` FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
