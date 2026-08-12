import { createHash } from "node:crypto";
import { seedParityReleaseServiceRequirements } from "./parity-seed-release-services.mjs";

export async function seedParityConfigRevisions({ prisma, ids, runtime }) {
  await seedParityReleaseServiceRequirements({ prisma, ids });
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
  const snapshot = {
    plainVariables: {
      HTTP_PLAIN_PARITY: role,
      ...(!staging ? { PORT: "4301" } : {}),
    },
    secretReferences: [
      { id: ids.secret, name: "parity-api-key", type: "api_key" },
    ],
    resourceReferences: resourceReferences(ids, environmentId, role),
    routeSnapshot: {
      domains: [
        staging ? "staging.parity.example.test" : "parity.example.test",
      ],
      proxyTarget: runtime.routeProxyTarget,
      tlsRequired: false,
      entries: [{
        domain: staging ? "staging.parity.example.test" : "parity.example.test",
        path: "/", component: "web", port: 80, tlsMode: "none",
      }],
    },
    observabilitySnapshot: {
      version: 1,
      profile: "local_acceptance_v1",
      logs: "local-runtime-logs-v1",
      metrics: "local-health-probe-v1",
      traces: "not-applicable-single-host-v1",
      alerts: "not-applicable-local-acceptance-v1",
    },
    policyReferences: [],
  };
  return {
    id: staging ? ids.configStaging : ids.configProduction,
    teamId: ids.team,
    projectId: ids.project,
    environmentId,
    createdById: ids.user,
    revision: 1,
    snapshotHash: hashSnapshot(snapshot),
    ...snapshot,
    source: "parity_seed",
  };
}

function resourceReferences(ids, environmentId, role) {
  const target = {
    id: ids.resourceInstance,
    kind: "resource_instance",
    sharedEnvironmentIds: [environmentId],
    risk: "medium",
    impact: `${role} release target`,
    stateful: true,
    resourceTypeKey: "parity-target-http",
    resourceTypeCategory: "compute",
  };
  if (role === "staging") return [target];
  return [
    target,
    {
      id: ids.managedResource,
      kind: "managed_resource",
      sharedEnvironmentIds: [environmentId],
      risk: "medium",
      impact: "production connectivity, capacity and restore-point evidence",
      stateful: true,
      resourceTypeKey: "parity-target-http",
      resourceTypeCategory: "compute",
    },
  ];
}

function hashSnapshot(snapshot) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)))
    .digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
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
      observabilitySnapshot: data.observabilitySnapshot,
      policyReferences: data.policyReferences,
      source: data.source,
    },
  });
}
