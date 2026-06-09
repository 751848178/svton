import type {
  AuthzAuthorizer,
  AuthzDecision,
  AuthzNormalizedPermission,
  AuthzPermissionCheckInput,
  AuthzPermissionGrant,
  AuthzRoleAssignment,
  AuthzRoleCheckInput,
  AuthzRoleDefinition,
  AuthzSchema,
} from './types';
import {
  matchesPermission,
  matchesPermissionScope,
  matchesScope,
  normalizePermission,
} from './utils';

function allowDecision(
  matchedRole?: string,
  matchedPermission?: AuthzNormalizedPermission,
  scope?: AuthzRoleCheckInput['scope'],
): AuthzDecision {
  return {
    allowed: true,
    reason: 'allowed',
    matchedRole,
    matchedPermission,
    scope,
  };
}

function denyDecision(
  reason: AuthzDecision['reason'],
  scope?: AuthzRoleCheckInput['scope'],
  matchedRole?: string,
  matchedPermission?: AuthzNormalizedPermission,
): AuthzDecision {
  return {
    allowed: false,
    reason,
    scope,
    matchedRole,
    matchedPermission,
  };
}

export function createAuthorizer(schema: AuthzSchema = {}): AuthzAuthorizer {
  const roles = schema.roles ?? {};
  const expandedRolesCache = new Map<string, string[]>();
  const rolePermissionsCache = new Map<string, AuthzNormalizedPermission[]>();

  const expandRoles = (role: string, stack = new Set<string>()): string[] => {
    const cached = expandedRolesCache.get(role);
    if (cached) {
      return cached;
    }

    if (stack.has(role)) {
      return [role];
    }

    stack.add(role);

    const roleDefinition = roles[role];
    const expanded = new Set<string>([role]);

    for (const inheritedRole of roleDefinition?.inherits ?? []) {
      for (const item of expandRoles(inheritedRole, stack)) {
        expanded.add(item);
      }
    }

    const result = Array.from(expanded);
    expandedRolesCache.set(role, result);
    stack.delete(role);
    return result;
  };

  const getRoleDefinitionPermissions = (
    role: string,
    stack = new Set<string>(),
  ): AuthzNormalizedPermission[] => {
    const cached = rolePermissionsCache.get(role);
    if (cached) {
      return cached;
    }

    if (stack.has(role)) {
      return [];
    }

    stack.add(role);

    const roleDefinition: AuthzRoleDefinition | undefined = roles[role];
    const permissions: AuthzNormalizedPermission[] = [];

    for (const inheritedRole of roleDefinition?.inherits ?? []) {
      permissions.push(...getRoleDefinitionPermissions(inheritedRole, stack));
    }

    for (const permission of roleDefinition?.permissions ?? []) {
      permissions.push(normalizePermission(permission));
    }

    rolePermissionsCache.set(role, permissions);
    stack.delete(role);
    return permissions;
  };

  const checkRoleAssignment = (
    assignment: AuthzRoleAssignment,
    requiredRoles: string[],
    scope: AuthzRoleCheckInput['scope'],
  ): AuthzDecision | undefined => {
    if (!matchesScope(assignment.scope, scope)) {
      return undefined;
    }

    const expandedRoles = expandRoles(assignment.role);
    const matchedRole = requiredRoles.find((role) => expandedRoles.includes(role));

    if (!matchedRole) {
      return undefined;
    }

    return allowDecision(matchedRole, undefined, scope);
  };

  const can = (input: AuthzPermissionCheckInput): AuthzDecision => {
    const requiredPermission = normalizePermission(input.permission);

    const directDecisions = (input.subject.permissions ?? []).flatMap((grant) => {
      const normalizedPermission = normalizePermission(grant.permission);

      if (!matchesScope(grant.scope, input.scope)) {
        return [];
      }

      if (!matchesPermissionScope(normalizedPermission, input.scope)) {
        return [];
      }

      if (!matchesPermission(normalizedPermission, requiredPermission)) {
        return [];
      }

      return [
        normalizedPermission.effect === 'deny'
          ? denyDecision('denied', input.scope, undefined, normalizedPermission)
          : allowDecision(undefined, normalizedPermission, input.scope),
      ];
    });

    const roleDecisions = (input.subject.roles ?? []).flatMap((assignment) => {
      if (!matchesScope(assignment.scope, input.scope)) {
        return [];
      }

      return getRoleDefinitionPermissions(assignment.role)
        .filter((permission) => matchesPermissionScope(permission, input.scope))
        .filter((permission) => matchesPermission(permission, requiredPermission))
        .map((permission) =>
          permission.effect === 'deny'
            ? denyDecision('denied', input.scope, assignment.role, permission)
            : allowDecision(assignment.role, permission, input.scope),
        );
    });

    const allDecisions = [...directDecisions, ...roleDecisions];
    const denied = allDecisions.find((decision) => !decision.allowed);
    if (denied) {
      return denied;
    }

    const allowed = allDecisions.find((decision) => decision.allowed);
    if (allowed) {
      return allowed;
    }

    return denyDecision('missing_permission', input.scope);
  };

  const hasRole = (input: AuthzRoleCheckInput): AuthzDecision => {
    for (const assignment of input.subject.roles ?? []) {
      const matched = checkRoleAssignment(assignment, input.roles, input.scope);
      if (matched) {
        return matched;
      }
    }

    return denyDecision('missing_role', input.scope);
  };

  return {
    can,
    hasRole,
    expandRoles: (role: string) => expandRoles(role),
    getRolePermissions: (role: string) => getRoleDefinitionPermissions(role),
  };
}
