import { bindPositiveApplicationContracts } from "./parity-positive-application-contracts.mjs";
import { POSITIVE_DELIVERY_FIXTURE_IDS } from "./parity-positive-delivery-fixture-ids.mjs";
import { claimPositiveResources } from "./parity-positive-resource-claim.mjs";
import { seedParityVersionHistory } from "./parity-seed-version-history.mjs";

export async function claimPositiveDeliveryFixture(options) {
  const scope = exactScope(options);
  const ids = {
    ...POSITIVE_DELIVERY_FIXTURE_IDS,
    project: scope.projectId,
    envStaging: scope.stagingEnvId,
    envProduction: scope.productionEnvId,
    configProduction: scope.productionConfigRevisionId,
  };
  if (typeof options.materializeHistory !== "function") {
    throw claimError("materialize-history");
  }
  const [digestA, digestB] = await options.materializeHistory(ids);
  requireDigest(digestA, "history-a");
  requireDigest(digestB, "history-b");
  const applications = await bindPositiveApplicationContracts(
    options.prisma,
    scope,
  );
  await claimPositiveResources(options.prisma, ids, scope);
  await seedParityVersionHistory({
    prisma: options.prisma,
    ids,
    pinnedCommit: options.pinnedCommit,
    digestA,
    digestB,
    capturedAt: options.capturedAt,
  });
  return readback(options.prisma, ids, scope, applications);
}

function exactScope(options) {
  const scope = {
    teamId: options.teamId,
    projectId: options.projectId,
    stagingEnvId: options.stagingEnvId,
    productionEnvId: options.productionEnvId,
    productionConfigRevisionId: options.productionConfigRevisionId,
  };
  for (const [key, value] of Object.entries(scope)) {
    if (typeof value !== "string" || value.length < 3 || value.length > 191) {
      throw claimError(`scope-${key}`);
    }
  }
  if (!/^[a-f0-9]{40}$/.test(options.pinnedCommit || "")) {
    throw claimError("pinned-commit");
  }
  if (!(options.capturedAt instanceof Date)) throw claimError("captured-at");
  return Object.freeze(scope);
}

async function readback(prisma, ids, scope, applications) {
  const [resources, history, bindings, identity] = await Promise.all([
    Promise.all([
      prisma.secretKey.count({
        where: { id: ids.secret, projectId: scope.projectId },
      }),
      prisma.resourceInstance.count({
        where: { id: ids.resourceInstance, projectId: scope.projectId },
      }),
      prisma.managedResource.count({
        where: {
          id: ids.managedResource,
          projectId: scope.projectId,
          environmentId: scope.productionEnvId,
        },
      }),
      prisma.site.count({
        where: {
          id: ids.site,
          projectId: scope.projectId,
          environmentId: scope.productionEnvId,
        },
      }),
    ]),
    prisma.environmentVersion.count({ where: { projectId: scope.projectId } }),
    prisma.projectEnvironmentServer.count({
      where: {
        projectId: scope.projectId,
        environmentId: { in: [scope.stagingEnvId, scope.productionEnvId] },
        status: "active",
      },
    }),
    Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { id: "parity-project-0001" } }),
      prisma.projectIntakeFinalization.count({
        where: { projectId: scope.projectId, status: "succeeded" },
      }),
      prisma.projectRepositoryIdentity.count({
        where: { projectId: scope.projectId },
      }),
    ]),
  ]);
  return {
    projectId: scope.projectId,
    stagingEnvId: scope.stagingEnvId,
    productionEnvId: scope.productionEnvId,
    resourceScopes: resources,
    environmentBindings: bindings,
    applicationContracts: applications,
    priorEnvironmentVersions: history,
    identityReadback: identity,
  };
}

function requireDigest(value, reason) {
  if (!/^sha256:[a-f0-9]{64}$/.test(value || "")) throw claimError(reason);
}

function claimError(reason) {
  return new Error(`PARITY_POSITIVE_DELIVERY_CLAIM_INVALID: ${reason}`);
}
