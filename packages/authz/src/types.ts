export type AuthzEffect = 'allow' | 'deny';

export interface AuthzScope {
  type: string;
  id?: string;
}

export interface AuthzNamedPermissionInput {
  permission: string;
  scopeTypes?: string[];
  effect?: AuthzEffect;
}

export interface AuthzPermissionDescriptor {
  resource: string;
  action: string;
  scopeTypes?: string[];
  effect?: AuthzEffect;
}

export type AuthzPermissionInput =
  | string
  | readonly [resource: string, action: string]
  | AuthzNamedPermissionInput
  | AuthzPermissionDescriptor;

export interface AuthzNormalizedPermission {
  key: string;
  resource: string;
  action: string;
  scopeTypes: string[];
  effect: AuthzEffect;
}

export interface AuthzRoleDefinition {
  inherits?: string[];
  permissions?: AuthzPermissionInput[];
}

export interface AuthzSchema {
  roles?: Record<string, AuthzRoleDefinition>;
}

export interface AuthzRoleAssignment {
  role: string;
  scope?: AuthzScope;
}

export interface AuthzPermissionGrant {
  permission: AuthzPermissionInput;
  scope?: AuthzScope;
}

export type AuthzPermissionGrantInput = AuthzPermissionInput | AuthzPermissionGrant;

export interface AuthzSubject {
  roles?: AuthzRoleAssignment[];
  permissions?: AuthzPermissionGrant[];
}

export type AuthzDecisionReason =
  | 'allowed'
  | 'denied'
  | 'missing_permission'
  | 'missing_role';

export interface AuthzDecision {
  allowed: boolean;
  reason: AuthzDecisionReason;
  scope?: AuthzScope;
  matchedRole?: string;
  matchedPermission?: AuthzNormalizedPermission;
}

export interface AuthzRoleCheckInput {
  subject: AuthzSubject;
  roles: string[];
  scope?: AuthzScope;
}

export interface AuthzPermissionCheckInput {
  subject: AuthzSubject;
  permission: AuthzPermissionInput;
  scope?: AuthzScope;
}

export interface AuthzAuthorizer {
  can(input: AuthzPermissionCheckInput): AuthzDecision;
  hasRole(input: AuthzRoleCheckInput): AuthzDecision;
  expandRoles(role: string): string[];
  getRolePermissions(role: string): AuthzNormalizedPermission[];
}
