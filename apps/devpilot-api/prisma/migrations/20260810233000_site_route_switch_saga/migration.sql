ALTER TABLE `SiteRouteSwitchRun`
  ADD COLUMN `operationId` VARCHAR(191) NULL,
  ADD COLUMN `providerKey` VARCHAR(191) NULL,
  ADD COLUMN `desiredRoute` JSON NULL,
  ADD COLUMN `previousRoute` JSON NULL,
  ADD COLUMN `applyReceipt` JSON NULL,
  ADD COLUMN `compensationOperationId` VARCHAR(191) NULL,
  ADD COLUMN `compensationReceipt` JSON NULL,
  ADD COLUMN `lastError` TEXT NULL,
  ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `recoveryAttemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `recoveryLeaseId` VARCHAR(191) NULL,
  ADD COLUMN `recoveryLeaseUntil` DATETIME(3) NULL,
  ADD COLUMN `nextRecoveryAt` DATETIME(3) NULL,
  ADD COLUMN `alertedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `SiteRouteSwitchRun`
SET
  `operationId` = CONCAT('legacy-site-route-switch:', `id`),
  `providerKey` = 'legacy-audit',
  `desiredRoute` = COALESCE(JSON_EXTRACT(`result`, '$.routeSwitch'), JSON_OBJECT()),
  `applyReceipt` = JSON_EXTRACT(`result`, '$.routeSwitch.receipt'),
  `attemptCount` = 1,
  `finishedAt` = COALESCE(`finishedAt`, `createdAt`),
  `status` = CASE
    WHEN `status` = 'switched'
      AND JSON_UNQUOTE(JSON_EXTRACT(`result`, '$.routeSwitch.receipt.status')) = 'switched'
      AND JSON_UNQUOTE(JSON_EXTRACT(`result`, '$.routeSwitch.receipt.observed.routeHash')) = JSON_UNQUOTE(JSON_EXTRACT(`result`, '$.routeSwitch.routeHash'))
      AND EXISTS (
        SELECT 1
        FROM `DeploymentRun` dr
        INNER JOIN `EnvironmentVersion` ev ON ev.`deploymentRunId` = dr.`id`
        INNER JOIN `ProjectEnvironment` pe
          ON pe.`id` = ev.`environmentId`
          AND pe.`currentEnvironmentVersionId` = ev.`id`
        INNER JOIN `Site` s
          ON s.`id` = `SiteRouteSwitchRun`.`siteId`
        WHERE dr.`id` = `SiteRouteSwitchRun`.`deploymentRunId`
          AND dr.`status` = 'completed'
          AND ev.`environmentId` = `SiteRouteSwitchRun`.`environmentId`
          AND JSON_UNQUOTE(JSON_EXTRACT(s.`routeSwitch`, '$.deploymentRunId')) = dr.`id`
          AND JSON_UNQUOTE(JSON_EXTRACT(s.`routeSwitch`, '$.routeHash')) = JSON_UNQUOTE(JSON_EXTRACT(`SiteRouteSwitchRun`.`result`, '$.routeSwitch.routeHash'))
      )
      THEN 'committed'
    WHEN `status` = 'not_applied'
      OR JSON_UNQUOTE(JSON_EXTRACT(`result`, '$.routeSwitch.receipt.status')) = 'not_applied'
      THEN 'failed'
    ELSE 'compensation_required'
  END;

UPDATE `SiteRouteSwitchRun`
SET `lastError` = CASE
  WHEN `status` = 'committed' THEN NULL
  WHEN `status` = 'failed' THEN COALESCE(`reasonCode`, 'legacy_route_switch_not_applied')
  ELSE 'legacy_route_switch_state_requires_reconciliation'
END;

ALTER TABLE `SiteRouteSwitchRun`
  MODIFY `operationId` VARCHAR(191) NOT NULL,
  MODIFY `providerKey` VARCHAR(191) NOT NULL,
  MODIFY `desiredRoute` JSON NOT NULL,
  ADD UNIQUE INDEX `SiteRouteSwitchRun_operationId_key`(`operationId`),
  ADD UNIQUE INDEX `SiteRouteSwitchRun_compensationOperationId_key`(`compensationOperationId`),
  ADD INDEX `SiteRouteSwitchRun_status_updatedAt_idx`(`status`, `updatedAt`),
  ADD INDEX `SiteRouteSwitchRun_status_nextRecoveryAt_idx`(`status`, `nextRecoveryAt`);
