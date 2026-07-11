import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { OperationApprovalRequirementRepository } from "./operation-approval-requirement.repository";
import {
  CreateOperationApprovalInput,
  OperationApprovalRequirement,
  OperationApprovalRequirementPolicyRecord,
} from "./operation-approval.types";

@Injectable()
export class OperationApprovalRequirementService {
  constructor(
    private readonly requirementRepository: OperationApprovalRequirementRepository,
  ) {}

  async evaluate(
    input: CreateOperationApprovalInput,
  ): Promise<OperationApprovalRequirement> {
    const [requesterRole, policies] = await Promise.all([
      this.requirementRepository.findRequesterRole(
        input.teamId,
        input.requesterId,
      ),
      this.requirementRepository.listCandidatePolicies(input),
    ]);
    const matchedPolicies = policies.filter((policy) =>
      this.matchesPolicy(policy, input),
    );
    const allowPolicies = matchedPolicies.filter(
      (policy) => policy.effect === "allow",
    );

    return {
      required: true,
      source: "control_access_policy",
      reason: this.buildReason(input, allowPolicies, matchedPolicies),
      resourceType: input.targetType,
      operationType: input.action,
      category: input.category,
      risk: input.risk,
      projectId: input.projectId ?? null,
      environmentId: input.environmentId ?? null,
      requesterRole,
      ownerBypass: true,
      defaultReviewerRole: "admin",
      additionalReviewerRoles: this.allowedRoles(allowPolicies),
      reviewerUserIds: this.allowedUsers(allowPolicies),
      matchedPolicies: matchedPolicies.map((policy) => ({
        id: policy.id,
        name: policy.name,
        effect: policy.effect,
        principalType: policy.principalType,
        principalRole: policy.principalRole,
        principalUserId: policy.principalUserId,
        projectId: policy.projectId,
        environmentId: policy.environmentId,
        priority: policy.priority,
      })),
    };
  }

  private buildReason(
    input: CreateOperationApprovalInput,
    allowPolicies: OperationApprovalRequirementPolicyRecord[],
    matchedPolicies: OperationApprovalRequirementPolicyRecord[],
  ) {
    const base = `${input.risk} 风险操作 ${input.category}/${input.action} 需要审批`;
    const scope = `资源类型 ${input.targetType}，环境 ${input.environmentId ?? "全局"}`;
    if (allowPolicies.length > 0) {
      return `${base}；命中 ${allowPolicies.length} 条允许审批规则（${scope}）`;
    }
    if (matchedPolicies.length > 0) {
      return `${base}；存在匹配的控制面策略，需 owner 或未被 deny 的 admin 审批（${scope}）`;
    }
    return `${base}；未命中放宽规则，默认需 owner 或 admin 审批（${scope}）`;
  }

  private matchesPolicy(
    policy: OperationApprovalRequirementPolicyRecord,
    input: CreateOperationApprovalInput,
  ) {
    return (
      this.matchesStringList(policy.categories, input.category) &&
      this.matchesStringList(policy.actions, input.action) &&
      this.matchesStringList(policy.riskLevels, input.risk)
    );
  }

  private matchesStringList(value: Prisma.JsonValue | null, needle?: string) {
    if (!needle) return true;
    const list = this.readStringList(value);
    return (
      list.length === 0 ||
      list.some((pattern) => this.matchesPattern(pattern, needle))
    );
  }

  private matchesPattern(pattern: string, needle: string) {
    if (pattern === "*" || pattern === needle) return true;
    if (!pattern.endsWith(".*")) return false;
    return needle.startsWith(pattern.slice(0, -1));
  }

  private readStringList(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }

  private allowedRoles(policies: OperationApprovalRequirementPolicyRecord[]) {
    return this.unique(
      policies
        .filter((policy) => policy.principalType === "team_role")
        .map((policy) => policy.principalRole)
        .filter((role): role is string => Boolean(role) && role !== "admin"),
    );
  }

  private allowedUsers(policies: OperationApprovalRequirementPolicyRecord[]) {
    return this.unique(
      policies
        .filter((policy) => policy.principalType === "user")
        .map((policy) => policy.principalUserId)
        .filter((userId): userId is string => Boolean(userId)),
    );
  }

  private unique(values: string[]) {
    return Array.from(new Set(values));
  }
}
