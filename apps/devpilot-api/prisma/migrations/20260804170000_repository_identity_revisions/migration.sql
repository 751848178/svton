CREATE TABLE `ProjectRepositoryIdentityRevision` (
  `id` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `identityId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `revision` INTEGER NOT NULL,
  `expectedRevision` INTEGER NOT NULL,
  `defaultBranch` VARCHAR(191) NOT NULL,
  `verifiedCommitSha` VARCHAR(64) NOT NULL,
  `reason` TEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProjectRepositoryIdentityRevision_identityId_revision_key` (`identityId`, `revision`),
  UNIQUE INDEX `ProjectRepositoryIdentityRevision_projectId_idempotencyKey_key` (`projectId`, `idempotencyKey`),
  INDEX `ProjectRepositoryIdentityRevision_teamId_idx` (`teamId`),
  INDEX `ProjectRepositoryIdentityRevision_projectId_idx` (`projectId`),
  INDEX `ProjectRepositoryIdentityRevision_createdById_idx` (`createdById`),
  INDEX `ProjectRepositoryIdentityRevision_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProjectRepositoryIdentity`
  ADD COLUMN `currentRevisionId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `ProjectRepositoryIdentity_currentRevisionId_key` (`currentRevisionId`);

ALTER TABLE `BuildRun`
  ADD COLUMN `repositoryIdentityId` VARCHAR(191) NULL,
  ADD COLUMN `repositoryIdentityRevisionId` VARCHAR(191) NULL,
  ADD INDEX `BuildRun_repositoryIdentityId_idx` (`repositoryIdentityId`),
  ADD INDEX `BuildRun_repositoryIdentityRevisionId_idx` (`repositoryIdentityRevisionId`);

ALTER TABLE `ProjectRepositoryIdentityRevision`
  ADD CONSTRAINT `ProjectRepositoryIdentityRevision_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectRepositoryIdentityRevision_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectRepositoryIdentityRevision_identityId_fkey`
    FOREIGN KEY (`identityId`) REFERENCES `ProjectRepositoryIdentity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectRepositoryIdentityRevision_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `ProjectRepositoryIdentityRevision` (
  `id`, `teamId`, `projectId`, `identityId`, `revision`, `expectedRevision`, `defaultBranch`, `verifiedCommitSha`, `reason`, `idempotencyKey`
)
SELECT
  CONCAT('identity-rev-', identity.`id`), identity.`teamId`, identity.`projectId`, identity.`id`, 1, 0,
  identity.`defaultBranch`,
  connection.`commitSha`,
  'Initial canonical branch recorded by F416 migration', CONCAT('migration:', identity.`id`, ':1')
FROM `ProjectRepositoryIdentity` identity
JOIN `RepositoryConnection` connection
  ON connection.`id` = identity.`repositoryConnectionId`
  AND connection.`teamId` = identity.`teamId`
  AND connection.`projectId` = identity.`projectId`
WHERE connection.`status` = 'connected'
  AND connection.`verifiedAt` IS NOT NULL
  AND connection.`provider` = identity.`provider`
  AND connection.`repositoryUrl` IN (
    identity.`canonicalUrl`,
    CONCAT(identity.`canonicalUrl`, '.git'),
    CONCAT(identity.`canonicalUrl`, '/'),
    CONCAT(identity.`canonicalUrl`, '.git/')
  )
  AND (
    identity.`providerRepositoryId` IS NULL
    OR identity.`providerRepositoryId` = connection.`externalRepositoryId`
  )
  AND connection.`commitSha` REGEXP '^[0-9A-Fa-f]{40}([0-9A-Fa-f]{24})?$'
  AND connection.`commitSha` NOT REGEXP '^0+$'
  AND identity.`defaultBranch` IS NOT NULL
  AND connection.`defaultBranch` = identity.`defaultBranch`
  AND connection.`selectedBranch` = identity.`defaultBranch`;

UPDATE `ProjectRepositoryIdentity` identity
JOIN `ProjectRepositoryIdentityRevision` revision
  ON revision.`identityId` = identity.`id` AND revision.`revision` = 1
SET identity.`currentRevisionId` = revision.`id`;

ALTER TABLE `ProjectRepositoryIdentity`
  ADD CONSTRAINT `ProjectRepositoryIdentity_currentRevisionId_fkey`
    FOREIGN KEY (`currentRevisionId`) REFERENCES `ProjectRepositoryIdentityRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BuildRun`
  ADD CONSTRAINT `BuildRun_repositoryIdentityId_fkey`
    FOREIGN KEY (`repositoryIdentityId`) REFERENCES `ProjectRepositoryIdentity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BuildRun_repositoryIdentityRevisionId_fkey`
    FOREIGN KEY (`repositoryIdentityRevisionId`) REFERENCES `ProjectRepositoryIdentityRevision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
