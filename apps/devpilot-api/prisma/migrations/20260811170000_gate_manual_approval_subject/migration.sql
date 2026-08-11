ALTER TABLE `GateManualApproval`
  ADD COLUMN `approvalSubjectHash` VARCHAR(191) NULL;

CREATE INDEX `GateManualApproval_approvalSubjectHash_idx`
  ON `GateManualApproval`(`approvalSubjectHash`);

CREATE INDEX `GateManualApproval_releaseOrderId_approvalSubjectHash_requesterActorId_idx`
  ON `GateManualApproval`(
    `releaseOrderId`,
    `approvalSubjectHash`,
    `requesterActorId`
  );

CREATE UNIQUE INDEX `GateManualApproval_gateEvaluationId_evaluationInputHash_approvalSubjectHash_reviewerActorId_key`
  ON `GateManualApproval`(
    `gateEvaluationId`,
    `evaluationInputHash`,
    `approvalSubjectHash`,
    `reviewerActorId`
  );
