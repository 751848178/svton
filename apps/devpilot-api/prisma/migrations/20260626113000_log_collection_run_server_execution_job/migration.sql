-- Link queued log collection runs to ServerExecutionJob.
ALTER TABLE `LogCollectionRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

CREATE INDEX `LogCollectionRun_serverExecutionJobId_idx` ON `LogCollectionRun`(`serverExecutionJobId`);

ALTER TABLE `LogCollectionRun`
  ADD CONSTRAINT `LogCollectionRun_serverExecutionJobId_fkey`
  FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
