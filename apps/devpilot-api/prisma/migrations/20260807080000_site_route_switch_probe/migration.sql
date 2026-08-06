-- F438: additive Site route-switch + real DNS probe evidence
-- 1) Site: latest real DNS probe + latest Production route-switch pointer (append-only audit below)
ALTER TABLE `Site`
    ADD COLUMN `dns` JSON NULL,
    ADD COLUMN `routeSwitch` JSON NULL;

-- 2) Append-only Production route switch audit table
CREATE TABLE `SiteRouteSwitchRun` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `environmentId` VARCHAR(191) NULL,
    `deploymentRunId` VARCHAR(191) NULL,
    `releaseRunId` VARCHAR(191) NULL,
    `targetRef` VARCHAR(191) NULL,
    `proxyTarget` VARCHAR(191) NULL,
    `domains` JSON NULL,
    `result` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'switched',
    `reasonCode` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SiteRouteSwitchRun_teamId_idx`(`teamId`),
    INDEX `SiteRouteSwitchRun_siteId_idx`(`siteId`),
    INDEX `SiteRouteSwitchRun_projectId_idx`(`projectId`),
    INDEX `SiteRouteSwitchRun_environmentId_idx`(`environmentId`),
    INDEX `SiteRouteSwitchRun_deploymentRunId_idx`(`deploymentRunId`),
    INDEX `SiteRouteSwitchRun_releaseRunId_idx`(`releaseRunId`),
    INDEX `SiteRouteSwitchRun_status_idx`(`status`),
    INDEX `SiteRouteSwitchRun_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_siteId_fkey`
    FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_environmentId_fkey`
    FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_deploymentRunId_fkey`
    FOREIGN KEY (`deploymentRunId`) REFERENCES `DeploymentRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteRouteSwitchRun` ADD CONSTRAINT `SiteRouteSwitchRun_releaseRunId_fkey`
    FOREIGN KEY (`releaseRunId`) REFERENCES `ReleaseRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
