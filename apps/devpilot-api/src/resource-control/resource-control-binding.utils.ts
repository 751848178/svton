/**
 * Pure resource-binding snapshot + query-credential-id helpers.
 *
 * Extracted from the binding service so it stays under the 200-line ceiling.
 * Stateless data shaping — no service / DB dependencies. No behavior change.
 */

import { Prisma } from '@prisma/client';
import { asRecord, asString } from './resource-control-value.utils';

type BindingResource = {
  projectId: string | null;
  environmentId: string | null;
  serverId: string | null;
  credentialId: string | null;
  config: Prisma.JsonValue | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  credential?: { id: string; name: string; type: string } | null;
};

export function resolveQueryCredentialId(resource: { config: Prisma.JsonValue | null }) {
  const config = asRecord(resource.config);
  const credentialBindings = asRecord(config.credentialBindings as Prisma.JsonValue | null);
  return asString(credentialBindings.queryCredentialId);
}

export function buildResourceBindingSnapshot(resource: BindingResource) {
  return {
    projectId: resource.projectId,
    projectName: resource.project?.name,
    environmentId: resource.environmentId,
    environmentName: resource.environment?.name,
    environmentKey: resource.environment?.key,
    serverId: resource.serverId,
    serverName: resource.server?.name,
    serverHost: resource.server?.host,
    credentialId: resource.credentialId,
    credentialName: resource.credential?.name,
    credentialType: resource.credential?.type,
    queryCredentialId: resolveQueryCredentialId(resource),
  };
}

export function mergeQueryCredentialBinding(configValue: Prisma.JsonValue | null, queryCredentialId: string | null) {
  const config = asRecord(configValue);
  const credentialBindings = asRecord(config.credentialBindings as Prisma.JsonValue | null);
  const nextCredentialBindings: Record<string, unknown> = { ...credentialBindings };
  if (queryCredentialId) {
    nextCredentialBindings.queryCredentialId = queryCredentialId;
  } else {
    delete nextCredentialBindings.queryCredentialId;
  }
  const nextConfig: Record<string, unknown> = { ...config, credentialBindings: nextCredentialBindings };
  if (Object.keys(nextCredentialBindings).length === 0) {
    delete nextConfig.credentialBindings;
  }
  return nextConfig;
}
