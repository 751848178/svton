import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { MemberRole } from '../team/dto/team.dto';
import {
  CreateControlAccessPolicyDto,
  ListControlAccessPoliciesQueryDto,
  UpdateControlAccessPolicyDto,
} from './dto/control-access-policy.dto';

type DefaultMinimumRole = 'member' | 'admin';

type ControlAccessCheckInput = {
  teamId: string;
  actorId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  category: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  risk?: string | null;
  phase: 'approval_request' | 'approval_review' | 'approved_execution' | 'control_write' | 'control_read' | 'sensitive_read';
};

type PolicyRecord = {
  id: string;
  name: string;
  effect: string;
  principalType: string;
  principalRole: string | null;
  principalUserId: string | null;
  projectId: string | null;
  environmentId: string | null;
  categories: Prisma.JsonValue | null;
  actions: Prisma.JsonValue | null;
  riskLevels: Prisma.JsonValue | null;
};

@Injectable()
export class ControlAccessPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventService: AuditEventService,
  ) {}

  async list(teamId: string, query: ListControlAccessPoliciesQueryDto) {
    const where: Prisma.ControlAccessPolicyWhereInput = { teamId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.principalUserId) where.principalUserId = query.principalUserId;
    if (query.principalRole) where.principalRole = query.principalRole;
    if (query.principalType) where.principalType = query.principalType;
    if (query.effect) where.effect = query.effect;
    if (query.enabled === 'true') where.enabled = true;
    if (query.enabled === 'false') where.enabled = false;

    const policies = await this.prisma.controlAccessPolicy.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      include: this.policyInclude(),
    });

    return policies.filter((policy) => (
      this.matchesStringList(policy.categories, query.category) &&
      this.matchesStringList(policy.actions, query.action) &&
      this.matchesStringList(policy.riskLevels, query.risk)
    ));
  }

  async create(teamId: string, userId: string, dto: CreateControlAccessPolicyDto) {
    await this.assertBindings(teamId, dto.projectId, dto.environmentId, dto.principalUserId);
    this.assertPrincipal(dto.principalType || 'team_role', dto.principalRole, dto.principalUserId);

    const policy = await this.prisma.controlAccessPolicy.create({
      data: {
        teamId,
        createdById: userId,
        principalUserId: dto.principalUserId || undefined,
        projectId: dto.projectId || undefined,
        environmentId: dto.environmentId || undefined,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        effect: dto.effect || 'allow',
        principalType: dto.principalType || 'team_role',
        principalRole: dto.principalRole || undefined,
        categories: this.toStringListJson(dto.categories),
        actions: this.toStringListJson(dto.actions),
        riskLevels: this.toStringListJson(dto.riskLevels),
        priority: dto.priority ?? 0,
      },
      include: this.policyInclude(),
    });

    await this.writePolicyAudit(policy, userId, 'access_policy.created', 'completed');
    return policy;
  }

  async update(teamId: string, userId: string, id: string, dto: UpdateControlAccessPolicyDto) {
    const existing = await this.prisma.controlAccessPolicy.findFirst({
      where: { id, teamId },
      include: this.policyInclude(),
    });

    if (!existing) {
      throw new NotFoundException('控制面访问策略不存在');
    }

    const nextProjectId = dto.projectId !== undefined ? dto.projectId || undefined : existing.projectId || undefined;
    const nextEnvironmentId = dto.environmentId !== undefined
      ? dto.environmentId || undefined
      : existing.environmentId || undefined;
    const nextPrincipalUserId = dto.principalUserId !== undefined
      ? dto.principalUserId || undefined
      : existing.principalUserId || undefined;
    const nextPrincipalType = dto.principalType || existing.principalType;
    const nextPrincipalRole = dto.principalRole !== undefined
      ? dto.principalRole || undefined
      : existing.principalRole || undefined;

    await this.assertBindings(teamId, nextProjectId, nextEnvironmentId, nextPrincipalUserId);
    this.assertPrincipal(nextPrincipalType, nextPrincipalRole, nextPrincipalUserId);

    const data: Prisma.ControlAccessPolicyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.effect !== undefined) data.effect = dto.effect;
    if (dto.principalType !== undefined) data.principalType = dto.principalType;
    if (dto.principalRole !== undefined) data.principalRole = dto.principalRole || null;
    if (dto.principalUserId !== undefined) {
      data.principalUser = dto.principalUserId
        ? { connect: { id: dto.principalUserId } }
        : { disconnect: true };
    }
    if (dto.projectId !== undefined) data.project = dto.projectId ? { connect: { id: dto.projectId } } : { disconnect: true };
    if (dto.environmentId !== undefined) {
      data.environment = dto.environmentId ? { connect: { id: dto.environmentId } } : { disconnect: true };
    }
    if (dto.categories !== undefined) data.categories = this.toStringListJson(dto.categories);
    if (dto.actions !== undefined) data.actions = this.toStringListJson(dto.actions);
    if (dto.riskLevels !== undefined) data.riskLevels = this.toStringListJson(dto.riskLevels);
    if (dto.priority !== undefined) data.priority = dto.priority;

    const policy = await this.prisma.controlAccessPolicy.update({
      where: { id },
      data,
      include: this.policyInclude(),
    });

    await this.writePolicyAudit(policy, userId, 'access_policy.updated', 'completed');
    return policy;
  }

  async delete(teamId: string, userId: string, id: string) {
    const existing = await this.prisma.controlAccessPolicy.findFirst({
      where: { id, teamId },
      include: this.policyInclude(),
    });

    if (!existing) {
      throw new NotFoundException('控制面访问策略不存在');
    }

    await this.prisma.controlAccessPolicy.delete({ where: { id } });
    await this.writePolicyAudit(existing, userId, 'access_policy.deleted', 'completed');
    return { deleted: true };
  }

  async assertCanRequestApproval(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'approval_request' }, 'member');
  }

  async assertCanReviewApproval(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'approval_review' }, 'admin');
  }

  async assertCanExecuteApproved(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'approved_execution' }, 'member');
  }

  async assertCanWrite(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'control_write' }, 'admin');
  }

  async assertCanSelfServiceWrite(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'control_write' }, 'member');
  }

  async assertCanRead(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'control_read' }, 'member');
  }

  async assertCanSensitiveRead(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.assertAllowed({ ...input, phase: 'sensitive_read' }, 'admin');
  }

  async canRead(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.canAccess({ ...input, phase: 'control_read' }, 'member');
  }

  async canSensitiveRead(input: Omit<ControlAccessCheckInput, 'phase'>) {
    return this.canAccess({ ...input, phase: 'sensitive_read' }, 'admin');
  }

  async assertAllowed(input: ControlAccessCheckInput, defaultMinimumRole: DefaultMinimumRole) {
    const membership = await this.resolveMembership(input.teamId, input.actorId);
    if (membership.role === MemberRole.OWNER) {
      return { allowed: true, mode: 'owner_bypass' };
    }

    const policies = await this.loadCandidatePolicies(input);
    const matchedPolicies = policies.filter((policy) => this.matchesPolicy(policy, input, membership));
    const denied = matchedPolicies.find((policy) => policy.effect === 'deny');
    if (denied) {
      throw new ForbiddenException(
        `控制面访问策略「${denied.name}」拒绝 ${input.category}/${input.action}`,
      );
    }

    const allowed = matchedPolicies.find((policy) => policy.effect === 'allow');
    if (allowed) {
      return { allowed: true, mode: 'policy_allow', policyId: allowed.id };
    }

    if (this.roleSatisfies(membership.role, defaultMinimumRole)) {
      return { allowed: true, mode: `default_${defaultMinimumRole}` };
    }

    throw new ForbiddenException('缺少控制面操作权限');
  }

  private async canAccess(input: ControlAccessCheckInput, defaultMinimumRole: DefaultMinimumRole) {
    try {
      await this.assertAllowed(input, defaultMinimumRole);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return false;
      }
      throw error;
    }
  }

  private async resolveMembership(teamId: string, userId?: string | null) {
    if (!userId) {
      throw new ForbiddenException('缺少操作用户');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('无权访问该团队');
    }

    return { role: membership.role as MemberRole, userId };
  }

  private async loadCandidatePolicies(input: ControlAccessCheckInput): Promise<PolicyRecord[]> {
    const scope: Prisma.ControlAccessPolicyWhereInput[] = [
      { projectId: null, environmentId: null },
    ];

    if (input.projectId) {
      scope.push({ projectId: input.projectId, environmentId: null });
    }

    if (input.environmentId) {
      scope.push({ projectId: null, environmentId: input.environmentId });
      if (input.projectId) {
        scope.push({ projectId: input.projectId, environmentId: input.environmentId });
      }
    }

    return this.prisma.controlAccessPolicy.findMany({
      where: {
        teamId: input.teamId,
        enabled: true,
        OR: scope,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        effect: true,
        principalType: true,
        principalRole: true,
        principalUserId: true,
        projectId: true,
        environmentId: true,
        categories: true,
        actions: true,
        riskLevels: true,
      },
    });
  }

  private matchesPolicy(
    policy: PolicyRecord,
    input: ControlAccessCheckInput,
    membership: { role: MemberRole; userId: string },
  ) {
    return (
      this.matchesPrincipal(policy, membership) &&
      this.matchesStringList(policy.categories, input.category) &&
      this.matchesStringList(policy.actions, input.action) &&
      this.matchesStringList(policy.riskLevels, input.risk || undefined)
    );
  }

  private matchesPrincipal(policy: PolicyRecord, membership: { role: MemberRole; userId: string }) {
    if (policy.principalType === 'any') return true;
    if (policy.principalType === 'user') return policy.principalUserId === membership.userId;
    if (policy.principalType === 'team_role') return policy.principalRole === membership.role;
    return false;
  }

  private roleSatisfies(role: MemberRole, minimumRole: DefaultMinimumRole) {
    if (role === MemberRole.OWNER) return true;
    if (minimumRole === 'member') {
      return role === MemberRole.ADMIN || role === MemberRole.MEMBER;
    }
    return role === MemberRole.ADMIN;
  }

  private async assertBindings(
    teamId: string,
    projectId?: string | null,
    environmentId?: string | null,
    principalUserId?: string | null,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, teamId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('项目不存在或不属于当前团队');
      }
    }

    if (environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: environmentId, teamId, status: 'active' },
        select: { id: true, projectId: true },
      });
      if (!environment) {
        throw new NotFoundException('项目环境不存在或不属于当前团队');
      }
      if (projectId && environment.projectId !== projectId) {
        throw new BadRequestException('项目环境必须属于所选项目');
      }
    }

    if (principalUserId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: principalUserId } },
        select: { id: true },
      });
      if (!membership) {
        throw new NotFoundException('授权用户不是当前团队成员');
      }
    }
  }

  private assertPrincipal(
    principalType: string,
    principalRole?: string | null,
    principalUserId?: string | null,
  ) {
    if (!['team_role', 'user', 'any'].includes(principalType)) {
      throw new BadRequestException('无效授权主体类型');
    }
    if (principalRole && !['owner', 'admin', 'member'].includes(principalRole)) {
      throw new BadRequestException('无效团队角色');
    }
    if (principalType === 'user' && !principalUserId) {
      throw new BadRequestException('用户级策略必须选择授权用户');
    }
    if (principalType === 'team_role' && !principalRole) {
      throw new BadRequestException('团队角色策略必须选择角色');
    }
  }

  private policyInclude(): Prisma.ControlAccessPolicyInclude {
    return {
      createdBy: { select: { id: true, name: true, email: true } },
      principalUser: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
    };
  }

  private matchesStringList(value: Prisma.JsonValue | null, needle?: string) {
    if (!needle) return true;
    const list = this.readStringList(value);
    return list.length === 0 || list.some((pattern) => this.matchesPattern(pattern, needle));
  }

  private matchesPattern(pattern: string, needle: string) {
    if (pattern === '*') return true;
    if (pattern === needle) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1);
      return needle.startsWith(prefix);
    }
    return false;
  }

  private toStringListJson(values?: string[] | null): Prisma.InputJsonValue {
    return this.cleanStringList(values);
  }

  private readStringList(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return this.cleanStringList(value.filter((item): item is string => typeof item === 'string'));
  }

  private cleanStringList(values?: string[] | null): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }

  private async writePolicyAudit(
    policy: {
      id: string;
      teamId: string;
      projectId: string | null;
      environmentId: string | null;
      name: string;
      effect: string;
      principalType: string;
      principalRole: string | null;
      principalUserId: string | null;
    },
    actorId: string,
    action: string,
    status: string,
  ) {
    await this.auditEventService.create({
      teamId: policy.teamId,
      actorId,
      projectId: policy.projectId,
      environmentId: policy.environmentId,
      category: 'access_policy',
      action,
      targetType: 'control_access_policy',
      targetId: policy.id,
      risk: 'medium',
      status,
      summary: `控制面访问策略「${policy.name}」已变更`,
      metadata: {
        effect: policy.effect,
        principalType: policy.principalType,
        principalRole: policy.principalRole,
        principalUserId: policy.principalUserId,
      },
    });
  }
}
