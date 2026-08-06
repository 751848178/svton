import { Prisma } from "@prisma/client";
import type { DeploymentResourceReference } from "./release-deployment-input-reference.utils";
import type { ReleaseDeploymentResourceState } from "./release-deployment-input.types";

export type ReleaseDeploymentResourceDb = Pick<
  Prisma.TransactionClient,
  "resourceInstance" | "managedResource" | "site" | "cDNConfig"
>;

export async function loadReleaseDeploymentResources(
  db: ReleaseDeploymentResourceDb,
  scope: { teamId: string; projectId: string; environmentId: string },
  references: DeploymentResourceReference[],
) {
  const output: ReleaseDeploymentResourceState[] = [];
  for (const reference of references) {
    const row = await loadResource(db, scope, reference);
    if (row) output.push(row);
  }
  return output;
}

async function loadResource(
  db: ReleaseDeploymentResourceDb,
  scope: { teamId: string; projectId: string },
  reference: DeploymentResourceReference,
): Promise<ReleaseDeploymentResourceState | null> {
  const where = {
    id: reference.id,
    teamId: scope.teamId,
    projectId: scope.projectId,
  };
  if (reference.kind === "resource_instance") {
    const row = await db.resourceInstance.findFirst({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        environmentId: true,
        updatedAt: true,
        delivery: true,
        credentials: true,
        resourceType: { select: { envTemplate: true } },
      },
    });
    return row && environmentAllowed(row.environmentId, reference)
      ? {
          ...row,
          kind: reference.kind,
          sharedEnvironmentIds: reference.sharedEnvironmentIds,
          runtime: {
            delivery: row.delivery,
            credentials: row.credentials,
            envTemplate: row.resourceType.envTemplate,
          },
        }
      : null;
  }
  const model =
    reference.kind === "managed_resource"
      ? db.managedResource
      : reference.kind === "site"
        ? db.site
        : db.cDNConfig;
  const row = await (model as typeof db.managedResource).findFirst({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      environmentId: true,
      updatedAt: true,
    },
  });
  return row && environmentAllowed(row.environmentId, reference)
    ? {
        ...row,
        kind: reference.kind,
        sharedEnvironmentIds: reference.sharedEnvironmentIds,
      }
    : null;
}

function environmentAllowed(
  environmentId: string | null,
  reference: DeploymentResourceReference,
) {
  return (
    !environmentId || reference.sharedEnvironmentIds.includes(environmentId)
  );
}
