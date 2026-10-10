import type { Prisma } from '../../generated/client/index.js';

/** Safe database projection; hashes, secrets and request/receipt JSON never reach the directory. */
export const registeredAgentSelect = {
  id: true, name: true, workspaceId: true, incarnation: true, approvedRole: true, resourceKind: true,
  credentialRevision: true, trustRevision: true, disabled: true, draining: true, createdAt: true,
  actor: { select: { disabled: true, kind: true } },
  session: { select: { epoch: true, incarnation: true, credentialRevision: true, trustRevision: true,
    lastSeenAt: true, leaseExpiresAt: true, reportedRole: true, capabilitiesJson: true, version: true, docker: true } },
} satisfies Prisma.AgentSelect;
export type DirectoryAgent = Prisma.AgentGetPayload<{ select: typeof registeredAgentSelect }>;
