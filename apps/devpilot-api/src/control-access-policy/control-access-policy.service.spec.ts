import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { MemberRole } from '../team/dto/team.dto';
import { ControlAccessPolicyService } from './control-access-policy.service';

type PrismaMock = {
  teamMember: {
    findUnique: jest.Mock;
  };
  controlAccessPolicy: {
    findMany: jest.Mock;
  };
};

type PolicyFixture = {
  id?: string;
  name?: string;
  effect?: 'allow' | 'deny';
  principalType?: 'team_role' | 'user' | 'any';
  principalRole?: MemberRole | null;
  principalUserId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  categories?: string[] | null;
  actions?: string[] | null;
  riskLevels?: string[] | null;
};

const teamId = 'team-1';
const actorId = 'user-1';
const projectId = 'project-1';
const environmentId = 'env-prod';

describe('ControlAccessPolicyService', () => {
  let prisma: PrismaMock;
  let service: ControlAccessPolicyService;

  beforeEach(() => {
    prisma = {
      teamMember: {
        findUnique: jest.fn(),
      },
      controlAccessPolicy: {
        findMany: jest.fn(),
      },
    };
    const auditEventService = { create: jest.fn() };
    service = new ControlAccessPolicyService(
      prisma as unknown as PrismaService,
      auditEventService as unknown as AuditEventService,
    );
  });

  it('lets owners bypass policy lookup', async () => {
    mockMembership(MemberRole.OWNER);

    await expect(service.assertCanWrite({
      teamId,
      actorId,
      projectId,
      category: 'deployment',
      action: 'deployment.rollback',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'high',
    })).resolves.toEqual({ allowed: true, mode: 'owner_bypass' });
    expect(prisma.controlAccessPolicy.findMany).not.toHaveBeenCalled();
  });

  it('defaults read access to team members when no policy matches', async () => {
    mockMembership(MemberRole.MEMBER);
    mockPolicies([]);

    await expect(service.assertCanRead({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'resource',
      action: 'resource.read',
      targetType: 'managed_resource',
      targetId: 'resource-1',
      risk: 'low',
    })).resolves.toEqual({ allowed: true, mode: 'default_member' });
  });

  it('requires admin by default for control writes', async () => {
    mockMembership(MemberRole.MEMBER);
    mockPolicies([]);

    await expect(service.assertCanWrite({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'resource',
      action: 'resource.action.restart',
      targetType: 'managed_resource',
      targetId: 'resource-1',
      risk: 'high',
    })).rejects.toThrow(new ForbiddenException('缺少控制面操作权限'));
  });

  it('allows scoped writes when an allow policy matches category, action pattern, risk, and role', async () => {
    mockMembership(MemberRole.MEMBER);
    mockPolicies([
      policy({
        id: 'allow-resource-actions',
        name: '允许成员执行资源动作',
        effect: 'allow',
        principalRole: MemberRole.MEMBER,
        projectId,
        environmentId,
        categories: ['resource'],
        actions: ['resource.action.*'],
        riskLevels: ['high'],
      }),
    ]);

    await expect(service.assertCanWrite({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'resource',
      action: 'resource.action.restart',
      targetType: 'managed_resource',
      targetId: 'resource-1',
      risk: 'high',
    })).resolves.toEqual({
      allowed: true,
      mode: 'policy_allow',
      policyId: 'allow-resource-actions',
    });
  });

  it('gives deny policies priority over matching allow policies', async () => {
    mockMembership(MemberRole.ADMIN);
    mockPolicies([
      policy({
        id: 'allow-deployment-read',
        name: '允许读取部署',
        effect: 'allow',
        principalRole: MemberRole.ADMIN,
        projectId,
        environmentId,
        categories: ['deployment'],
        actions: ['deployment_run.read'],
      }),
      policy({
        id: 'deny-prod-deployment-read',
        name: '拒绝读取生产部署',
        effect: 'deny',
        principalRole: MemberRole.ADMIN,
        projectId,
        environmentId,
        categories: ['deployment'],
        actions: ['deployment_run.read'],
      }),
    ]);

    await expect(service.assertCanRead({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'deployment',
      action: 'deployment_run.read',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'low',
    })).rejects.toThrow('控制面访问策略「拒绝读取生产部署」拒绝 deployment/deployment_run.read');

    await expect(service.canRead({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'deployment',
      action: 'deployment_run.read',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'low',
    })).resolves.toBe(false);
  });

  it('keeps sensitive reads admin-only without an explicit allow policy', async () => {
    mockMembership(MemberRole.MEMBER);
    mockPolicies([]);

    await expect(service.assertCanSensitiveRead({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'secret_key',
      action: 'secret_key.value.read',
      targetType: 'secret_key',
      targetId: 'key-1',
      risk: 'high',
    })).rejects.toThrow(new ForbiddenException('缺少控制面操作权限'));
  });

  it('allows admins to perform sensitive reads by default', async () => {
    mockMembership(MemberRole.ADMIN);
    mockPolicies([]);

    await expect(service.assertCanSensitiveRead({
      teamId,
      actorId,
      projectId,
      environmentId,
      category: 'secret_key',
      action: 'secret_key.value.read',
      targetType: 'secret_key',
      targetId: 'key-1',
      risk: 'high',
    })).resolves.toEqual({ allowed: true, mode: 'default_admin' });
  });

  function mockMembership(role: MemberRole) {
    prisma.teamMember.findUnique.mockResolvedValue({ role });
  }

  function mockPolicies(policies: ReturnType<typeof policy>[]) {
    prisma.controlAccessPolicy.findMany.mockResolvedValue(policies);
  }
});

function policy(input: PolicyFixture) {
  return {
    id: input.id || 'policy-1',
    name: input.name || '策略',
    effect: input.effect || 'allow',
    principalType: input.principalType || 'team_role',
    principalRole: input.principalRole === undefined ? MemberRole.MEMBER : input.principalRole,
    principalUserId: input.principalUserId ?? null,
    projectId: input.projectId ?? null,
    environmentId: input.environmentId ?? null,
    categories: jsonList(input.categories),
    actions: jsonList(input.actions),
    riskLevels: jsonList(input.riskLevels),
  };
}

function jsonList(values?: string[] | null): Prisma.JsonValue | null {
  return values === undefined ? [] : values;
}
