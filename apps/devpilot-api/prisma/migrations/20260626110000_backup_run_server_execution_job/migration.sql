-- Link queued backup runs to ServerExecutionJob.
ALTER TABLE `BackupRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

CREATE INDEX `BackupRun_serverExecutionJobId_idx` ON `BackupRun`(`serverExecutionJobId`);

ALTER TABLE `BackupRun`
  ADD CONSTRAINT `BackupRun_serverExecutionJobId_fkey`
  FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
