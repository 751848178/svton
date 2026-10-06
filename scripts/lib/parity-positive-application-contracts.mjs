const LOCAL_RESOURCE_REQUIREMENTS = Object.freeze({
  cpuMillicores: 100,
  memoryBytes: 67_108_864,
  diskBytes: 67_108_864,
});

const COMPONENTS = Object.freeze([
  Object.freeze({
    name: "web",
    repoPath: "apps/web",
    ports: Object.freeze([80]),
    staging: Object.freeze({
      workingDirectory: "apps/web",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/web/dist"],
      workloadExecutionMode: "managed-process-v1",
      deployCommand: "node dist/server.mjs 4310",
      healthCheckUrl: "http://127.0.0.1:4310/health",
      healthCheckAttempts: 3,
      healthCheckIntervalMs: 250,
      healthCheckTimeoutMs: 2_000,
      resourceRequirements: LOCAL_RESOURCE_REQUIREMENTS,
    }),
    production: Object.freeze({
      workingDirectory: "apps/web",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/web/dist"],
      workloadExecutionMode: "managed-process-v1",
      deployCommand: "node dist/server.mjs 4311",
      healthCheckUrl: "http://127.0.0.1:4311/health",
      healthCheckAttempts: 3,
      healthCheckIntervalMs: 250,
      healthCheckTimeoutMs: 2_000,
      resourceRequirements: LOCAL_RESOURCE_REQUIREMENTS,
    }),
  }),
  Object.freeze({
    name: "api",
    repoPath: "apps/api",
    ports: Object.freeze([4300]),
    staging: Object.freeze({
      workingDirectory: "apps/api",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/api/dist"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist/server.js",
      statusCommand: "test -f dist/server.js",
      failureCleanupCommand: "true",
      resourceRequirements: LOCAL_RESOURCE_REQUIREMENTS,
    }),
    production: Object.freeze({
      workingDirectory: "apps/api",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/api/dist"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist/server.js",
      statusCommand: "test -f dist/server.js",
      failureCleanupCommand: "true",
      resourceRequirements: LOCAL_RESOURCE_REQUIREMENTS,
    }),
  }),
]);

export async function bindPositiveApplicationContracts(prisma, scope) {
  const applications = await prisma.application.findMany({
    where: { projectId: scope.projectId, status: "active" },
    select: {
      id: true,
      name: true,
      repoPath: true,
      services: {
        where: { status: "active" },
        select: { id: true, name: true, environmentId: true },
      },
    },
  });
  const bound = [];
  for (const component of COMPONENTS) {
    const application = applications.find(
      (item) =>
        item.repoPath === component.repoPath || item.name === component.name,
    );
    if (!application) throw contractError(`application-${component.name}`);
    const canonicalName =
      application.services.find(
        (service) => service.environmentId === scope.productionEnvId,
      )?.name || component.name;
    const staging = await bindService(
      prisma,
      scope,
      application,
      component,
      "staging",
      canonicalName,
    );
    const production = await bindService(
      prisma,
      scope,
      application,
      component,
      "production",
      canonicalName,
    );
    bound.push({
      component: component.name,
      applicationId: application.id,
      staging,
      production,
    });
  }
  return bound;
}

function bindService(prisma, scope, application, component, role, name) {
  const environmentId =
    role === "staging" ? scope.stagingEnvId : scope.productionEnvId;
  const existing = application.services.find(
    (service) => service.environmentId === environmentId,
  );
  if (existing) {
    return prisma.applicationService.update({
      where: { id: existing.id },
      data: {
        status: "active",
        ports: component.ports,
        deployConfig: component[role],
      },
      select: { id: true, name: true, ports: true },
    });
  }
  return prisma.applicationService.upsert({
    where: {
      applicationId_environmentId_name: {
        applicationId: application.id,
        environmentId,
        name,
      },
    },
    create: {
      teamId: scope.teamId,
      projectId: scope.projectId,
      applicationId: application.id,
      environmentId,
      name,
      ports: component.ports,
      status: "active",
      deployConfig: component[role],
    },
    update: {
      status: "active",
      ports: component.ports,
      deployConfig: component[role],
    },
    select: { id: true, name: true, ports: true },
  });
}

function contractError(reason) {
  return new Error(`PARITY_POSITIVE_DELIVERY_CLAIM_INVALID: ${reason}`);
}
