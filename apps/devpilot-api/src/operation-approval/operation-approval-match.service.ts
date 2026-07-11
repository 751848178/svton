import { BadRequestException, Injectable } from "@nestjs/common";
import {
  OperationApprovalMatchRecord,
  ValidateOperationApprovalInput,
} from "./operation-approval.types";

@Injectable()
export class OperationApprovalMatchService {
  assertMatches(
    approval: OperationApprovalMatchRecord,
    input: ValidateOperationApprovalInput,
  ) {
    const checks: Array<
      [string, string | null | undefined, string | null | undefined]
    > = [
      ["category", approval.category, input.category],
      ["action", approval.action, input.action],
      ["targetType", approval.targetType, input.targetType],
      ["targetId", approval.targetId, input.targetId ?? null],
      ["projectId", approval.projectId, input.projectId ?? null],
      ["environmentId", approval.environmentId, input.environmentId ?? null],
      ["applicationId", approval.applicationId, input.applicationId ?? null],
      [
        "applicationServiceId",
        approval.applicationServiceId,
        input.applicationServiceId ?? null,
      ],
      ["serverId", approval.serverId, input.serverId ?? null],
      ["siteId", approval.siteId, input.siteId ?? null],
      [
        "managedResourceId",
        approval.managedResourceId,
        input.managedResourceId ?? null,
      ],
    ];

    const mismatched = checks.find(
      ([, actual, expected]) => actual !== expected,
    );
    if (mismatched) {
      throw new BadRequestException(`审批单与本次操作不匹配: ${mismatched[0]}`);
    }
  }
}
