-- F444: environment config revisions now carry the immutable identity snapshot
-- (display name/description) so name/description edits become new revisions.
ALTER TABLE `EnvironmentConfigRevision`
    ADD COLUMN `displayName` VARCHAR(191) NULL,
    ADD COLUMN `displayDescription` TEXT NULL;

-- Backfill existing revisions with the identity as of the current environment row.
UPDATE `EnvironmentConfigRevision` revision
JOIN `ProjectEnvironment` environment
  ON environment.`id` = revision.`environmentId`
SET revision.`displayName` = environment.`name`,
    revision.`displayDescription` = environment.`description`
WHERE environment.`name` IS NOT NULL;
