import { Injectable } from "@nestjs/common";
import {
  CreateControlAccessPolicyDto,
  ListControlAccessPoliciesQueryDto,
  UpdateControlAccessPolicyDto,
} from "./dto/control-access-policy.dto";
import { ControlAccessPolicyAccessService } from "./control-access-policy-access.service";
import { ControlAccessPolicyCrudService } from "./control-access-policy-crud.service";
import { ControlAccessCheckInput } from "./control-access-policy.types";

@Injectable()
export class ControlAccessPolicyService {
  constructor(
    private readonly policyCrudService: ControlAccessPolicyCrudService,
    private readonly policyAccessService: ControlAccessPolicyAccessService,
  ) {}

  list(teamId: string, query: ListControlAccessPoliciesQueryDto) {
    return this.policyCrudService.list(teamId, query);
  }

  create(teamId: string, userId: string, dto: CreateControlAccessPolicyDto) {
    return this.policyCrudService.create(teamId, userId, dto);
  }

  update(
    teamId: string,
    userId: string,
    id: string,
    dto: UpdateControlAccessPolicyDto,
  ) {
    return this.policyCrudService.update(teamId, userId, id, dto);
  }

  delete(teamId: string, userId: string, id: string) {
    return this.policyCrudService.delete(teamId, userId, id);
  }

  assertCanRequestApproval(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "approval_request" },
      "member",
    );
  }

  assertCanReviewApproval(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "approval_review" },
      "admin",
    );
  }

  assertCanExecuteApproved(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "approved_execution" },
      "member",
    );
  }

  assertCanWrite(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "control_write" },
      "admin",
    );
  }

  assertCanSelfServiceWrite(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "control_write" },
      "member",
    );
  }

  assertCanRead(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "control_read" },
      "member",
    );
  }

  assertCanSensitiveRead(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.assertAllowed(
      { ...input, phase: "sensitive_read" },
      "admin",
    );
  }

  canRead(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.canAccess(
      { ...input, phase: "control_read" },
      "member",
    );
  }

  canSensitiveRead(input: Omit<ControlAccessCheckInput, "phase">) {
    return this.policyAccessService.canAccess(
      { ...input, phase: "sensitive_read" },
      "admin",
    );
  }
}
