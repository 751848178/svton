ALTER TABLE `GateManualApproval`
  ADD COLUMN `approvalSubjectHash` VARCHAR(191) NULL;

CREATE INDEX `GateManualApproval_approvalSubjectHash_idx`
  ON `GateManualApproval`(`approvalSubjectHash`);

CREATE INDEX `GateManualApproval_subject_requester_idx`
  ON `GateManualApproval`(
    `releaseOrderId`,
    `approvalSubjectHash`,
    `requesterActorId`
  );

CREATE UNIQUE INDEX `GateManualApproval_subject_reviewer_key`
  ON `GateManualApproval`(
    `gateEvaluationId`,
    `evaluationInputHash`,
    `approvalSubjectHash`,
    `reviewerActorId`
  );
