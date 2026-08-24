ALTER TABLE `ReleaseOrder`
  ADD COLUMN `releaseName` VARCHAR(100) NULL;

UPDATE `ReleaseOrder`
SET `releaseName` = `releaseVersion`
WHERE `releaseName` IS NULL;
