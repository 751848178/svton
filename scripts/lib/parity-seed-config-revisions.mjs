import { createHash } from "node:crypto";

export async function seedParityConfigRevisions({ prisma, ids, runtime }) {
  const staging = parityConfigRevisionData(ids, runtime, "staging");
  const production = parityConfigRevisionData(ids, runtime, "production");
  await Promise.all([
    upsertRevision(prisma, staging),
    upsertRevision(prisma, production),
  ]);
  await Promise.all([
    prisma.projectEnvironment.update({
      where: { id: ids.envStaging },
      data: { currentConfigRevisionId: staging.id },
    }),
    prisma.projectEnvironment.update({
      where: { id: ids.envProduction },
      data: { currentConfigRevisionId: production.id },
    }),
  ]);
}

export function parityConfigRevisionData(ids, runtime, role) {
  const staging = role === "staging";
  const environmentId = staging ? ids.envStaging : ids.envProduction;
  return {
    id: staging ? ids.configStaging : ids.configProduction,
    teamId: ids.team,
    projectId: ids.project,
    environmentId,
    createdById: ids.user,
    revision: 1,
    snapshotHash: createHash("sha256")
      .update(`parity-${role}-v1`)
      .digest("hex"),
    plainVariables: { HTTP_PLAIN_PARITY: role },
    secretReferences: [
      { id: ids.secret, name: "parity-api-key", type: "api_key" },
    ],
    resourceReferences: [
      {
        id: ids.resourceInstance,
        kind: "resource_instance",
        name: "parity-target-workload",
        sharedEnvironmentIds: [environmentId],
        risk: "medium",
        impact: `${role} release target`,
      },
    ],
    routeSnapshot: {
      domains: [
        staging ? "staging.parity.example.test" : "parity.example.test",
      ],
      proxyTarget: runtime.targetOrigin,
    },
    source: "parity_seed",
  };
}

async function upsertRevision(prisma, data) {
  await prisma.environmentConfigRevision.upsert({
    where: { id: data.id },
    create: data,
    update: {
      snapshotHash: data.snapshotHash,
      plainVariables: data.plainVariables,
      secretReferences: data.secretReferences,
      resourceReferences: data.resourceReferences,
      routeSnapshot: data.routeSnapshot,
      source: data.source,
    },
  });
}
