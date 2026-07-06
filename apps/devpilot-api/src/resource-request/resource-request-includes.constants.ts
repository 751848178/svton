/**
 * Shared Prisma `include` shapes for resource-request reads.
 *
 * Extracted verbatim from the original `ResourceRequestService`
 * `resourceRequestInclude()` and `resourceInstanceInclude()` private methods
 * so the repository and any focused read service can reuse one definition.
 */

export const resourceRequestInclude = {
  resourceType: {
    select: {
      id: true,
      key: true,
      name: true,
      category: true,
      provisioningMode: true,
      deliverySchema: true,
      envTemplate: true,
    },
  },
  project: {
    select: { id: true, name: true },
  },
  projectEnvironment: {
    select: { id: true, key: true, name: true, status: true },
  },
  requester: {
    select: { id: true, name: true, email: true },
  },
  reviewer: {
    select: { id: true, name: true, email: true },
  },
  instance: {
    select: { id: true, name: true, status: true, expiresAt: true, releasedAt: true },
  },
} as const;

export const resourceInstanceInclude = {
  resourceType: {
    select: { id: true, key: true, name: true, category: true },
  },
  project: {
    select: { id: true, name: true },
  },
  projectEnvironment: {
    select: { id: true, key: true, name: true, status: true },
  },
  request: {
    select: { id: true, title: true, status: true },
  },
} as const;
