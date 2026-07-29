-- F383 release initialization evidence bridge: record the auditable parent linkage
-- (releasePlanId / releaseStageId / releaseStageAttemptId) on the one-time
-- initialization checkpoint so a release-driven deployment can prove that the
-- release bootstrap stage already ran initialization, instead of being forced
-- to re-run (or fail on missing) an `initialization` step inside the deployment
-- command plan (releaseApplicationOnly=true strips it).
ALTER TABLE `ApplicationServiceInitialization`
    ADD COLUMN `releasePlanId` VARCHAR(191) NULL,
    ADD COLUMN `releaseStageId` VARCHAR(191) NULL,
    ADD COLUMN `releaseStageAttemptId` VARCHAR(191) NULL,
    ADD COLUMN `serverExecutionJobId` VARCHAR(191) NULL,
    ADD COLUMN `releaseEvidenceStatus` VARCHAR(191) NULL;

CREATE INDEX `ApplicationServiceInitialization_releaseStageAttemptId_idx`
    ON `ApplicationServiceInitialization`(`releaseStageAttemptId`);
