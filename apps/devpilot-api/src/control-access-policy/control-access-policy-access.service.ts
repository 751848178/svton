import { ForbiddenException, Injectable } from "@nestjs/common";
import { MemberRole } from "../team/dto/team.dto";
import { matchesStringList } from "./control-access-policy-match.utils";
import { ControlAccessPolicyRepository } from "./control-access-policy.repository";
import {
  ControlAccessCheckInput,
  DefaultMinimumRole,
  PolicyMembership,
  PolicyRecord,
} from "./control-access-policy.types";

@Injectable()
export class ControlAccessPolicyAccessService {
  constructor(
    private readonly policyRepository: ControlAccessPolicyRepository,
  ) {}

  async assertAllowed(
    input: ControlAccessCheckInput,
    defaultMinimumRole: DefaultMinimumRole,
  ) {
    const membership = await this.resolveMembership(
      input.teamId,
      input.actorId,
    );
    if (membership.role === MemberRole.OWNER) {
      return { allowed: true, mode: "owner_bypass" };
    }

    const policies = await this.policyRepository.loadCandidatePolicies(input);
    const matchedPolicies = policies.filter((policy) =>
      this.matchesPolicy(policy, input, membership),
    );
    const denied = matchedPolicies.find((policy) => policy.effect === "deny");
    if (denied) {
      throw new ForbiddenException(
        `控制面访问策略「${denied.name}」拒绝 ${input.category}/${input.action}`,
      );
    }

    const allowed = matchedPolicies.find((policy) => policy.effect === "allow");
    if (allowed) {
      return { allowed: true, mode: "policy_allow", policyId: allowed.id };
    }

    if (this.roleSatisfies(membership.role, defaultMinimumRole)) {
      return { allowed: true, mode: `default_${defaultMinimumRole}` };
    }

    throw new ForbiddenException("缺少控制面操作权限");
  }

  async canAccess(
    input: ControlAccessCheckInput,
    defaultMinimumRole: DefaultMinimumRole,
  ) {
    try {
      await this.assertAllowed(input, defaultMinimumRole);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  }

  private async resolveMembership(teamId: string, userId?: string | null) {
    if (!userId) throw new ForbiddenException("缺少操作用户");

    const membership = await this.policyRepository.resolveMembership(
      teamId,
      userId,
    );
    if (!membership) throw new ForbiddenException("无权访问该团队");
    return membership;
  }

  private matchesPolicy(
    policy: PolicyRecord,
    input: ControlAccessCheckInput,
    membership: PolicyMembership,
  ) {
    return (
      this.matchesPrincipal(policy, membership) &&
      matchesStringList(policy.categories, input.category) &&
      matchesStringList(policy.actions, input.action) &&
      matchesStringList(policy.riskLevels, input.risk || undefined)
    );
  }

  private matchesPrincipal(policy: PolicyRecord, membership: PolicyMembership) {
    if (policy.principalType === "any") return true;
    if (policy.principalType === "user")
      return policy.principalUserId === membership.userId;
    if (policy.principalType === "team_role")
      return policy.principalRole === membership.role;
    return false;
  }

  private roleSatisfies(role: MemberRole, minimumRole: DefaultMinimumRole) {
    if (role === MemberRole.OWNER) return true;
    if (minimumRole === "member") {
      return role === MemberRole.ADMIN || role === MemberRole.MEMBER;
    }
    return role === MemberRole.ADMIN;
  }
}
