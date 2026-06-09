export { createAuthorizer } from './authorizer';

export type {
  AuthzAuthorizer,
  AuthzDecision,
  AuthzDecisionReason,
  AuthzEffect,
  AuthzNormalizedPermission,
  AuthzPermissionCheckInput,
  AuthzPermissionDescriptor,
  AuthzPermissionGrant,
  AuthzPermissionGrantInput,
  AuthzPermissionInput,
  AuthzRoleAssignment,
  AuthzRoleCheckInput,
  AuthzRoleDefinition,
  AuthzSchema,
  AuthzScope,
  AuthzSubject,
} from './types';

export {
  normalizePermission,
  normalizePermissionGrants,
  normalizeRoleAssignments,
} from './utils';
