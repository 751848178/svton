-- Link queued application service operation runs to ServerExecutionJob.
ALTER TABLE `ApplicationServiceOperationRun` ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL;

CREATE INDEX `ApplicationServiceOperationRun_serverExecutionJobId_idx` ON `ApplicationServiceOperationRun`(`serverExecutionJobId`);

ALTER TABLE `ApplicationServiceOperationRun`
  ADD CONSTRAINT `ApplicationServiceOperationRun_serverExecutionJobId_fkey`
  FOREIGN KEY (`serverExecutionJobId`) REFERENCES `ServerExecutionJob`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
