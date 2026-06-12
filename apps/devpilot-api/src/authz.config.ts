import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ROLES_KEY, type AuthzModuleOptions } from '@svton/nestjs-authz';
import { PrismaService } from './prisma/prisma.service';
import { MemberRole } from './team/dto/team.dto';

const TEAM_SCOPE_TYPE = 'team';
const TEAM_MEMBER_AUTHZ_ROLE = 'team_member';
const TEAM_ADMIN_AUTHZ_ROLE = 'team_admin';
const TEAM_OWNER_AUTHZ_ROLE = 'team_owner';

interface TeamScopedRequest {
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  teamId?: string;
  teamRole?: MemberRole;
  user?: {
    id?: string;
    sub?: string;
  };
}

function getRequest(context: ExecutionContext): TeamScopedRequest {
  return context.switchToHttp().getRequest<TeamScopedRequest>();
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return readString(value[0]);
  }

  return undefined;
}

function resolveTeamId(request: TeamScopedRequest): string | undefined {
  return (
    readString(request.teamId) ??
    readString(request.params?.teamId) ??
    readString(request.query?.teamId) ??
    readString(request.body?.teamId) ??
    readString(request.headers?.['x-team-id'])
  );
}

function getRequiredRoles(context: ExecutionContext): string[] {
  const handlerRoles = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as string[] | undefined;
  const classRoles = Reflect.getMetadata(ROLES_KEY, context.getClass()) as string[] | undefined;
  return handlerRoles ?? classRoles ?? [];
}

function requiresTeamScope(context: ExecutionContext): boolean {
  return getRequiredRoles(context).some((role) => role.startsWith('team_'));
}

function resolveUserId(request: TeamScopedRequest): string | undefined {
  return readString(request.user?.id) ?? readString(request.user?.sub);
}

function mapTeamRole(role: string): string | undefined {
  switch (role) {
    case MemberRole.OWNER:
      return TEAM_OWNER_AUTHZ_ROLE;
    case MemberRole.ADMIN:
      return TEAM_ADMIN_AUTHZ_ROLE;
    case MemberRole.MEMBER:
      return TEAM_MEMBER_AUTHZ_ROLE;
    default:
      return undefined;
  }
}

export const useAuthzConfig = (prisma: PrismaService): AuthzModuleOptions => ({
  userRoleField: 'role',
  enableGlobalGuard: false,
  allowNoRoles: true,
  schema: {
    roles: {
      [TEAM_MEMBER_AUTHZ_ROLE]: {},
      [TEAM_ADMIN_AUTHZ_ROLE]: {
        inherits: [TEAM_MEMBER_AUTHZ_ROLE],
      },
      [TEAM_OWNER_AUTHZ_ROLE]: {
        inherits: [TEAM_ADMIN_AUTHZ_ROLE],
      },
    },
  },
  getAssignments: async (context) => {
    const request = getRequest(context);
    const teamId = resolveTeamId(request);
    const teamRoute = requiresTeamScope(context);

    if (!teamId) {
      if (teamRoute) {
        throw new ForbiddenException('缺少团队 ID');
      }

      return {};
    }

    request.teamId = teamId;

    const userId = resolveUserId(request);
    if (!userId) {
      return {};
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      if (teamRoute) {
        throw new ForbiddenException('无权访问该团队');
      }

      return {};
    }

    request.teamRole = membership.role as MemberRole;

    const mappedRole = mapTeamRole(membership.role);
    if (!mappedRole) {
      return {};
    }

    return {
      roles: [
        {
          role: mappedRole,
          scope: { type: TEAM_SCOPE_TYPE, id: teamId },
        },
      ],
    };
  },
  getScope: (context) => {
    const request = getRequest(context);
    const teamId = resolveTeamId(request);

    if (!teamId) {
      return undefined;
    }

    request.teamId = teamId;
    return { type: TEAM_SCOPE_TYPE, id: teamId };
  },
});
