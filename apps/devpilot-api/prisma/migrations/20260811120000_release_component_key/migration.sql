ALTER TABLE `ApplicationService`
  ADD COLUMN `releaseComponentKey` VARCHAR(191) NULL;

CREATE TEMPORARY TABLE `ReleaseComponentKeyBackfill` (
  `projectId` VARCHAR(191) NOT NULL,
  `applicationId` VARCHAR(191) NOT NULL,
  `normalizedName` VARCHAR(191) NOT NULL,
  `releaseComponentKey` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`projectId`, `applicationId`, `normalizedName`)
);

INSERT INTO `ReleaseComponentKeyBackfill`
  (`projectId`, `applicationId`, `normalizedName`, `releaseComponentKey`)
SELECT
  grouped.`projectId`,
  grouped.`applicationId`,
  grouped.`normalizedName`,
  CONCAT(
    'legacy-',
    SHA2(CONCAT(grouped.`applicationId`, CHAR(31), grouped.`normalizedName`), 256)
  )
FROM (
  SELECT
    service.`projectId` AS `projectId`,
    service.`applicationId` AS `applicationId`,
    LOWER(TRIM(service.`name`)) AS `normalizedName`
  FROM `ApplicationService` AS service
  INNER JOIN `ProjectEnvironment` AS environment
    ON environment.`id` = service.`environmentId`
    AND environment.`projectId` = service.`projectId`
    AND environment.`status` = 'active'
    AND environment.`baselineRole` IN ('staging', 'production')
  WHERE service.`status` = 'active'
  GROUP BY service.`projectId`, service.`applicationId`, LOWER(TRIM(service.`name`))
  HAVING COUNT(*) = 2
    AND COUNT(DISTINCT environment.`baselineRole`) = 2
) AS grouped;

UPDATE `ApplicationService` AS service
INNER JOIN `ProjectEnvironment` AS environment
  ON environment.`id` = service.`environmentId`
  AND environment.`projectId` = service.`projectId`
  AND environment.`status` = 'active'
  AND environment.`baselineRole` IN ('staging', 'production')
INNER JOIN `ReleaseComponentKeyBackfill` AS backfill
  ON backfill.`projectId` = service.`projectId`
  AND backfill.`applicationId` = service.`applicationId`
  AND backfill.`normalizedName` = LOWER(TRIM(service.`name`))
SET service.`releaseComponentKey` = backfill.`releaseComponentKey`
WHERE service.`releaseComponentKey` IS NULL;

DROP TEMPORARY TABLE `ReleaseComponentKeyBackfill`;

CREATE UNIQUE INDEX `ApplicationService_environmentId_releaseComponentKey_key`
  ON `ApplicationService`(`environmentId`, `releaseComponentKey`);
