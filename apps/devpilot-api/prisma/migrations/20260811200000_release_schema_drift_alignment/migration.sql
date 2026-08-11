ALTER TABLE `SiteRouteSwitchRun`
  MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'prepared',
  MODIFY `updatedAt` DATETIME(3) NOT NULL;

ALTER TABLE `ReleaseEvent`
  DROP FOREIGN KEY `ReleaseEvent_stageAttemptId_fkey`;

ALTER TABLE `ReleaseEvent`
  ADD CONSTRAINT `ReleaseEvent_stageAttemptId_fkey`
  FOREIGN KEY (`stageAttemptId`) REFERENCES `ReleaseStageAttempt`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX `ReleasePlan_id_key` ON `ReleasePlan`;
