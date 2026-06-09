import type {
  AuthzEffect,
  AuthzNamedPermissionInput,
  AuthzNormalizedPermission,
  AuthzPermissionDescriptor,
  AuthzPermissionGrant,
  AuthzPermissionGrantInput,
  AuthzPermissionInput,
  AuthzRoleAssignment,
  AuthzScope,
} from './types';

const INVALID_PERMISSION: AuthzNormalizedPermission = {
  key: '__invalid__:__invalid__',
  resource: '__invalid__',
  action: '__invalid__',
  scopeTypes: [],
  effect: 'deny',
};

function isNamedPermissionInput(
  input: AuthzPermissionInput,
): input is AuthzNamedPermissionInput {
  return typeof input === 'object' && !Array.isArray(input) && 'permission' in input;
}

function isPermissionDescriptor(
  input: AuthzPermissionInput,
): input is AuthzPermissionDescriptor {
  return typeof input === 'object' && !Array.isArray(input) && 'resource' in input && 'action' in input;
}

function parsePermissionKey(permission: string): { resource: string; action: string } {
  if (permission === '*' || permission === '*:*') {
    return { resource: '*', action: '*' };
  }

  const separatorIndex = permission.lastIndexOf(':');
  if (separatorIndex === -1) {
    return { resource: permission, action: '*' };
  }

  const resource = permission.slice(0, separatorIndex) || '*';
  const action = permission.slice(separatorIndex + 1) || '*';

  return { resource, action };
}

function normalizeEffect(effect: unknown): AuthzEffect {
  return effect === 'deny' ? 'deny' : 'allow';
}

function normalizeScopeTypes(scopeTypes: unknown): string[] {
  if (!Array.isArray(scopeTypes)) {
    return [];
  }

  return scopeTypes.filter((scopeType): scopeType is string => typeof scopeType === 'string');
}

export function normalizePermission(
  input: AuthzPermissionInput,
): AuthzNormalizedPermission {
  if (typeof input === 'string') {
    const parsed = parsePermissionKey(input);
    return {
      key: `${parsed.resource}:${parsed.action}`,
      resource: parsed.resource,
      action: parsed.action,
      scopeTypes: [],
      effect: 'allow',
    };
  }

  if (Array.isArray(input)) {
    const [resource, action] = input;
    if (typeof resource !== 'string' || typeof action !== 'string') {
      return INVALID_PERMISSION;
    }

    return {
      key: `${resource}:${action}`,
      resource,
      action,
      scopeTypes: [],
      effect: 'allow',
    };
  }

  if (isNamedPermissionInput(input)) {
    if (typeof input.permission !== 'string') {
      return INVALID_PERMISSION;
    }

    const parsed = parsePermissionKey(input.permission);
    return {
      key: `${parsed.resource}:${parsed.action}`,
      resource: parsed.resource,
      action: parsed.action,
      scopeTypes: normalizeScopeTypes(input.scopeTypes),
      effect: normalizeEffect(input.effect),
    };
  }

  if (isPermissionDescriptor(input)) {
    if (typeof input.resource !== 'string' || typeof input.action !== 'string') {
      return INVALID_PERMISSION;
    }

    return {
      key: `${input.resource}:${input.action}`,
      resource: input.resource,
      action: input.action,
      scopeTypes: normalizeScopeTypes(input.scopeTypes),
      effect: normalizeEffect(input.effect),
    };
  }

  return INVALID_PERMISSION;
}

export function matchesScope(
  assignmentScope: AuthzScope | undefined,
  requestedScope: AuthzScope | undefined,
): boolean {
  if (!assignmentScope) {
    return true;
  }

  if (!requestedScope) {
    return false;
  }

  if (assignmentScope.type !== '*' && assignmentScope.type !== requestedScope.type) {
    return false;
  }

  if (!assignmentScope.id) {
    return true;
  }

  if (!requestedScope.id) {
    return false;
  }

  return assignmentScope.id === '*' || assignmentScope.id === requestedScope.id;
}

export function matchesPermissionScope(
  permission: AuthzNormalizedPermission,
  requestedScope: AuthzScope | undefined,
): boolean {
  if (permission.scopeTypes.length === 0) {
    return true;
  }

  if (!requestedScope) {
    return false;
  }

  return permission.scopeTypes.includes('*') || permission.scopeTypes.includes(requestedScope.type);
}

export function matchesPermission(
  grantedPermission: AuthzNormalizedPermission,
  requiredPermission: AuthzNormalizedPermission,
): boolean {
  const resourceMatch =
    grantedPermission.resource === '*' ||
    requiredPermission.resource === '*' ||
    grantedPermission.resource === requiredPermission.resource;

  if (!resourceMatch) {
    return false;
  }

  return (
    grantedPermission.action === '*' ||
    requiredPermission.action === '*' ||
    grantedPermission.action === requiredPermission.action
  );
}

export function normalizeRoleAssignments(
  roles: string[] | AuthzRoleAssignment[] | undefined,
): AuthzRoleAssignment[] {
  if (!roles) {
    return [];
  }

  if (roles.every((role) => typeof role === 'string')) {
    return (roles as string[]).map((role) => ({ role }));
  }

  return roles as AuthzRoleAssignment[];
}

export function normalizePermissionGrants(
  permissions: AuthzPermissionGrantInput[] | undefined,
): AuthzPermissionGrant[] {
  if (!permissions) {
    return [];
  }

  return permissions.map((permission) => {
    if (
      typeof permission === 'object' &&
      !Array.isArray(permission) &&
      'permission' in permission &&
      'scope' in permission
    ) {
      return permission as AuthzPermissionGrant;
    }

    return {
      permission: permission as AuthzPermissionInput,
    };
  });
}
