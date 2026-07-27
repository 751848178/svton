-- AlterTable: OperationApproval 绑定输入快照哈希，配置变化后旧审批失效
ALTER TABLE `OperationApproval` ADD COLUMN `inputHash` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `OperationApproval_inputHash_idx` ON `OperationApproval`(`inputHash`);

-- CreateTable: 项目级发布计划（F383）
CREATE TABLE `ReleasePlan` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `environmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branch` VARCHAR(191) NULL,
    `commitSha` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `mode` VARCHAR(191) NOT NULL DEFAULT 'live',
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `blockedReason` TEXT NULL,
    `planHash` VARCHAR(191) NULL,
    `inputSnapshot` JSON NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReleasePlan_id_key`(`id`),
    INDEX `ReleasePlan_teamId_idx`(`teamId`),
    INDEX `ReleasePlan_projectId_idx`(`projectId`),
    INDEX `ReleasePlan_environmentId_idx`(`environmentId`),
    INDEX `ReleasePlan_createdByUserId_idx`(`createdByUserId`),
    INDEX `ReleasePlan_status_idx`(`status`),
    INDEX `ReleasePlan_planHash_idx`(`planHash`),
    INDEX `ReleasePlan_mode_idx`(`mode`),
    INDEX `ReleasePlan_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 发布阶段节点（F383）
CREATE TABLE `ReleaseStage` (
    `id` VARCHAR(191) NOT NULL,
    `releasePlanId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NULL,
    `applicationServiceId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `serverId` VARCHAR(191) NULL,
    `executorKind` VARCHAR(191) NOT NULL,
    `configSnapshot` JSON NULL,
    `configHash` VARCHAR(191) NULL,
    `outputSchema` JSON NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `concurrencyKey` VARCHAR(191) NULL,
    `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'low',
    `required` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `blockedReason` TEXT NULL,
    `currentAttempt` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `release_stage_plan_key`(`releasePlanId`, `key`),
    INDEX `ReleaseStage_teamId_idx`(`teamId`),
    INDEX `ReleaseStage_releasePlanId_idx`(`releasePlanId`),
    INDEX `ReleaseStage_applicationId_idx`(`applicationId`),
    INDEX `ReleaseStage_applicationServiceId_idx`(`applicationServiceId`),
    INDEX `ReleaseStage_environmentId_idx`(`environmentId`),
    INDEX `ReleaseStage_serverId_idx`(`serverId`),
    INDEX `ReleaseStage_type_idx`(`type`),
    INDEX `ReleaseStage_executorKind_idx`(`executorKind`),
    INDEX `ReleaseStage_status_idx`(`status`),
    INDEX `ReleaseStage_idempotencyKey_idx`(`idempotencyKey`),
    INDEX `ReleaseStage_concurrencyKey_idx`(`concurrencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 阶段依赖边（F383）
CREATE TABLE `ReleaseStageDependency` (
    `id` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `dependsOnStageId` VARCHAR(191) NOT NULL,
    `conditionType` VARCHAR(191) NOT NULL,
    `conditionSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `release_stage_dependency_pair`(`stageId`, `dependsOnStageId`),
    INDEX `ReleaseStageDependency_stageId_idx`(`stageId`),
    INDEX `ReleaseStageDependency_dependsOnStageId_idx`(`dependsOnStageId`),
    INDEX `ReleaseStageDependency_conditionType_idx`(`conditionType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 阶段执行尝试（F383）
CREATE TABLE `ReleaseStageAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `releaseStageId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `attemptNo` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `deploymentRunId` VARCHAR(191) NULL,
    `serverExecutionJobId` VARCHAR(191) NULL,
    `operationApprovalId` VARCHAR(191) NULL,
    `inputSnapshot` JSON NULL,
    `output` JSON NULL,
    `logSummary` JSON NULL,
    `error` TEXT NULL,
    `leaseOwner` VARCHAR(191) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `release_stage_attempt_no`(`releaseStageId`, `attemptNo`),
    INDEX `ReleaseStageAttempt_teamId_idx`(`teamId`),
    INDEX `ReleaseStageAttempt_releaseStageId_idx`(`releaseStageId`),
    INDEX `ReleaseStageAttempt_deploymentRunId_idx`(`deploymentRunId`),
    INDEX `ReleaseStageAttempt_serverExecutionJobId_idx`(`serverExecutionJobId`),
    INDEX `ReleaseStageAttempt_operationApprovalId_idx`(`operationApprovalId`),
    INDEX `ReleaseStageAttempt_status_idx`(`status`),
    INDEX `ReleaseStageAttempt_leaseOwner_idx`(`leaseOwner`),
    INDEX `ReleaseStageAttempt_leaseExpiresAt_idx`(`leaseExpiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 发布事件时间线（F383）
CREATE TABLE `ReleaseEvent` (
    `id` VARCHAR(191) NOT NULL,
    `releasePlanId` VARCHAR(191) NOT NULL,
    `releaseStageId` VARCHAR(191) NULL,
    `stageAttemptId` VARCHAR(191) NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL DEFAULT 'system',
    `actorId` VARCHAR(191) NULL,
    `correlationId` VARCHAR(191) NULL,
    `summary` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReleaseEvent_teamId_idx`(`teamId`),
    INDEX `ReleaseEvent_releasePlanId_idx`(`releasePlanId`),
    INDEX `ReleaseEvent_releaseStageId_idx`(`releaseStageId`),
    INDEX `ReleaseEvent_stageAttemptId_idx`(`stageAttemptId`),
    INDEX `ReleaseEvent_eventType_idx`(`eventType`),
    INDEX `ReleaseEvent_actorId_idx`(`actorId`),
    INDEX `ReleaseEvent_correlationId_idx`(`correlationId`),
    INDEX `ReleaseEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey constraints
ALTER TABLE `ReleasePlan` ADD CONSTRAINT `ReleasePlan_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleasePlan` ADD CONSTRAINT `ReleasePlan_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleasePlan` ADD CONSTRAINT `ReleasePlan_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleasePlan` ADD CONSTRAINT `ReleasePlan_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReleaseStage` ADD CONSTRAINT `ReleaseStage_releasePlanId_fkey` FOREIGN KEY (`releasePlanId`) REFERENCES `ReleasePlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseStage` ADD CONSTRAINT `ReleaseStage_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseStage` ADD CONSTRAINT `ReleaseStage_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReleaseStage` ADD CONSTRAINT `ReleaseStage_applicationServiceId_fkey` FOREIGN KEY (`applicationServiceId`) REFERENCES `ApplicationService`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReleaseStage` ADD CONSTRAINT `ReleaseStage_environmentId_fkey` FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReleaseStageDependency` ADD CONSTRAINT `ReleaseStageDependency_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ReleaseStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseStageDependency` ADD CONSTRAINT `ReleaseStageDependency_dependsOnStageId_fkey` FOREIGN KEY (`dependsOnStageId`) REFERENCES `ReleaseStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_releaseStageId_fkey` FOREIGN KEY (`releaseStageId`) REFERENCES `ReleaseStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_deploymentRunId_fkey` FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_serverExecutionJobId_fkey` FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ReleaseStageAttempt` ADD CONSTRAINT `ReleaseStageAttempt_operationApprovalId_fkey` FOREIGN KEY (`operationApprovalId`) REFERENCES `OperationApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ReleaseEvent` ADD CONSTRAINT `ReleaseEvent_releasePlanId_fkey` FOREIGN KEY (`releasePlanId`) REFERENCES `ReleasePlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseEvent` ADD CONSTRAINT `ReleaseEvent_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseEvent` ADD CONSTRAINT `ReleaseEvent_releaseStageId_fkey` FOREIGN KEY (`releaseStageId`) REFERENCES `ReleaseStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReleaseEvent` ADD CONSTRAINT `ReleaseEvent_stageAttemptId_fkey` FOREIGN KEY (`stageAttemptId`) REFERENCES `ReleaseStageAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
