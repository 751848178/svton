ALTER TABLE `ApplicationService`
  ADD COLUMN `releaseComponentKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ApplicationService_environmentId_releaseComponentKey_key`
  ON `ApplicationService`(`environmentId`, `releaseComponentKey`);
